import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { FederatedqueryComponent } from './federatedquery/federatedquery.component';
import { FormsModule }   from '@angular/forms';
import { FederateqService } from '../app/federateq.service';
import { AppRoutingModule } from '../app/shared/app.routing';
import { LoginComponent } from './login/login.component';
import { HashLocationStrategy, LocationStrategy} from '@angular/common';
import { ErrorComponent } from './error/error.component';
import { DropdownComponent } from './dropdown/dropdown.component';
import { EditorInputDirective } from './editorinput.directive';
import { QueryEditorComponent } from './query-editor/query-editor.component';
import { NavbarComponent } from './navbar/navbar.component';
import { NavbarDirective } from './navbar.directive';
import { TabManagerComponent } from './tab-manager/tab-manager.component';
import { VariableSetModalComponent } from './variable-set-modal/variable-set-modal.component';
import { SchedulerComponent } from './scheduler/scheduler.component';


@NgModule({
  declarations: [
    AppComponent,
    FederatedqueryComponent,
    LoginComponent,
    ErrorComponent,
    DropdownComponent,
    EditorInputDirective,
    QueryEditorComponent,
    NavbarComponent,
    NavbarDirective,
    TabManagerComponent,
    VariableSetModalComponent,
    SchedulerComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [FederateqService, {provide: LocationStrategy, useClass:HashLocationStrategy}],
  bootstrap: [AppComponent]
})

export class AppModule {
}
