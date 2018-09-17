import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FederatedqueryComponent } from './federatedquery.component';

describe('FederatedqueryComponent', () => {
  let component: FederatedqueryComponent;
  let fixture: ComponentFixture<FederatedqueryComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FederatedqueryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FederatedqueryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
