import { Component, OnInit } from '@angular/core';

declare var $:any;
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  constructor() { }

  ngOnInit() {
   //Materialize Modal initialization
   $(document).ready(function(){
    $('.modal').modal();
  });

  }

}
