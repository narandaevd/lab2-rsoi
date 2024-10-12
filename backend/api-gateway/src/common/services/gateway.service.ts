import { DefaultValuePipe, Get, Injectable, NotFoundException, ParseIntPipe, Query } from "@nestjs/common";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { CreateReservationRequest } from "dtos";

const extractData = (res: AxiosResponse) => res.data;

@Injectable()
export class GatewayService {
  constructor() {
    this.reservationAdapter = axios.create({baseURL: 'http://localhost:8070/api/v1'});
    this.loyaltyAdapter = axios.create({baseURL: 'http://localhost:8050/api/v1'});
    this.paymentAdapter = axios.create({baseURL: 'http://localhost:8060/api/v1'});
  }

  private reservationAdapter: AxiosInstance;
  private loyaltyAdapter: AxiosInstance;
  private paymentAdapter: AxiosInstance;

  async getHotels(params: {page: number; size: number}) {
    const response = await this.reservationAdapter.get('hotels', {
      params
    });
    return response.data;
  }

  private getNumberOfNights(startDate: Date, endDate: Date): number {
    const start = startDate;
    const end = endDate;
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Неверный формат даты");
    }
    const diffTime = (end as any) - (start as any);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.floor(diffDays));
  }

  async getMe(username: string) {
    const loyalty = await this.loyaltyAdapter.get(`loyalty/${username}`).then(extractData);
    const reservations = await this.reservationAdapter.get('reservations', {
      headers: {
        'X-User-Name': username,
      }
    }).then(extractData);
    const payments = await this.paymentAdapter.get('payments', {
      params: {
        uids: JSON.stringify(reservations.map(r => r.paymentUid)),
      }
    }).then(extractData);
    const reservationsWithFullAddresses = reservations.map(res => ({
      ...res,
      hotel: {
        ...res.hotel,
        fullAddress: buildFullAddress(res.hotel)
      }
    }));
    return {
      reservations: this.mergeReservationsAndPayments(reservationsWithFullAddresses, payments),
      loyalty,
    };
  }

  mergeReservationsAndPayments(reservs, payments) {
    return reservs.map(reservation => {
      const payment = payments.find(payment => payment.paymentUid === reservation.paymentUid);
      return {
        ...reservation,
        payment: payment ?? null,
      };
    });
  }

  async getUserReservations(
    username: string
  ) {
    const reservations = await this.reservationAdapter.get(`reservations`, {
      headers: {'X-User-Name': username},
    }).then(extractData);
    const payments = await this.paymentAdapter.get('payments', {
      params: {
        uids: JSON.stringify(reservations.map(r => r.paymentUid)),
      }
    }).then(extractData);
    return this.mergeReservationsAndPayments(reservations, payments);
  }

  async createReservation(username: string, dto: CreateReservationRequest) {
    const hotel = await this.reservationAdapter.get(`hotels/${dto.hotelUid}`).then(extractData);
    const loyalty = await this.loyaltyAdapter.get(`loyalty/${username}`).then(extractData);
    const rawPrice = this.getNumberOfNights(new Date(dto.startDate), new Date(dto.endDate)) * hotel.price;
    const priceWithDiscount = rawPrice - (rawPrice * loyalty.discount / 100.0);
    const payment = await this.paymentAdapter.post('payments', {
      price: priceWithDiscount,
      status: "PAID",
    }).then(extractData);
    const createdReservation = await this.reservationAdapter.post('reservations', {
      paymentUid: (payment as any).paymentUid,
      username,
      status: 'PAID',
      ...dto,
    }).then(extractData);
    await this.loyaltyAdapter.put(`loyalty/reservation_count`, {strategy: 'INCREMENT', username});
    createdReservation.payment = payment;
    createdReservation.hotelUid = hotel.hotelUid;
    createdReservation.discount = loyalty.discount;
    return createdReservation;
  }

  async cancelReservation(username: string, uid: string) {
    const reservationToCancel = await this.getUserReservationByUid(uid, username);
    if (reservationToCancel.status === 'CANCELED')
      throw new NotFoundException('Уже отменена бронь');
    await this.reservationAdapter.delete(`reservations/${uid}`, {
      headers: {
        'X-User-Name': username,
      }
    });
    await this.paymentAdapter.delete(`payments/${reservationToCancel.paymentUid}`);
    await this.loyaltyAdapter.put(`loyalty/reservation_count`, {strategy: 'DECREMENT', username});
  }

  async getUserReservationByUid(
    reservationUid: string,
    username: string
  ) {
    const reservation = await this.reservationAdapter.get(`reservations/${reservationUid}`, {
      headers: {'X-User-Name': username},
    }).then(extractData);
    reservation.hotel.fullAddress = buildFullAddress(reservation.hotel);
    reservation.hotel.address = undefined;
    const payment = await this.paymentAdapter.get(`payments/${reservation.paymentUid}`).then(extractData);
    reservation.payment = payment;
    return reservation;
  }

  async getLoyalty(username: string) {
    return await this.loyaltyAdapter.get(`loyalty/${username}`).then(extractData);
  }
}

function buildFullAddress(hotel) {
  return [
    hotel.country,
    hotel.city,
    hotel.address,
  ].join(', ');
}