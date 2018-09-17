import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { VariableSetModalComponent } from './variable-set-modal.component';

describe('VariableSetModalComponent', () => {
  let component: VariableSetModalComponent;
  let fixture: ComponentFixture<VariableSetModalComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ VariableSetModalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VariableSetModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
