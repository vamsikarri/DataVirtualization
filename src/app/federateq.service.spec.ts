import { TestBed, inject } from '@angular/core/testing';

import { FederateqService } from './federateq.service';

describe('FederateqService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FederateqService]
    });
  });
  it('should be created', inject([FederateqService], (service: FederateqService) => {
    expect(service).toBeTruthy();
  }));
});
