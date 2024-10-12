import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { PersonsService } from 'persons/persons.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Person } from 'persons/person.entity';
import { Repository } from 'typeorm';
import {faker} from '@faker-js/faker';
import {mock} from 'jest-mock-extended';
import { PersonRequest } from 'persons/dtos/person.request';

describe('Person', () => {
  let app: INestApplication;

  let service: PersonsService;
  let findResult = [
    new Person(),
    new Person(),
  ];
  const repo = mock<Repository<Person>>({
    find: jest.fn().mockImplementationOnce(() => findResult),
    findOneBy: jest.fn(),
    findOne: jest.fn(),
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        PersonsService, 
        {
          provide: getRepositoryToken(Person),
          useValue: repo,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    service = app.get(PersonsService);
  });

  it('getAll', async () => {
    const response = await service.getAll();

    expect(response.length).toBe(findResult.length);
    expect(response.every(maybePerson => maybePerson instanceof Person))
      .toBe(true);
  });

  it('getById (success)', async () => {
    const personId = faker.number.int();
    repo.findOneBy.mockImplementationOnce(async () => {
      const person = new Person();
      person.id = personId;
      return person;
    });

    const foundPerson = await service.getById(personId);

    expect(foundPerson).toBeDefined();
    expect(foundPerson.id).toBe(personId);
  });

  it('getById (not found)', async () => {
    const personId = faker.number.int();
    repo.findOneBy.mockResolvedValueOnce(null);

    expect(() => service.getById(personId)).rejects.toThrow(NotFoundException);
  });

  it('getById (not found)', async () => {
    const personId = faker.number.int();
    const updateDto = new PersonRequest();
    updateDto.name = faker.string.alpha();
    repo.findOne.mockResolvedValueOnce(null);

    expect(() => service.update(personId, updateDto))
      .rejects
      .toThrow(NotFoundException);
  });
});
