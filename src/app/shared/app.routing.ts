import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { FederatedqueryComponent } from '../federatedquery/federatedquery.component';
import { LoginComponent } from '../login/login.component';
import { ErrorComponent } from '../error/error.component';


@NgModule({
  imports: [
    RouterModule.forRoot([
        {path: 'home', component: FederatedqueryComponent},
        {path: 'login', component:  LoginComponent},
        {path: '**', component:  ErrorComponent},
        
      ])
  ],
  exports: [ RouterModule ]
})

export class AppRoutingModule {}
