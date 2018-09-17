import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TabManagerComponent } from './tab-manager.component';

describe('TabManagerComponent', () => {
  let component: TabManagerComponent;
  let fixture: ComponentFixture<TabManagerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TabManagerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TabManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
