import { Component, ElementRef } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { FederateqService } from '../federateq.service';
import { Utility } from '../Utility';

@Component({
    selector: 'app-scheduler',
    templateUrl: './scheduler.component.html',
    styleUrls: ['./scheduler.component.css']
})
export class SchedulerComponent extends ModalComponent {
    private queryIDField: JQuery<HTMLElement>;
    private queryID: string;

    constructor(el: ElementRef, private federateService: FederateqService) {
        super(el);
        this.queryID = "";
    }

    ngAfterViewInit() {
        this.queryIDField = $(this.body).find('.query-id');
        let src = this.federateService;
        let selectFields = Utility.setMap(
            ['.template-names'],
            [src.getTemplateNames()]
        )

        selectFields.forEach((source, identifier) => {
            source.subscribe(
                (results) => {
                    results = results.map(el => `<option value="${el}">${el}</option>`);
                    $(this.body).find(identifier).append(results.join(''));
                    ($(this.body).find(identifier) as any).formSelect();
                }
            )
        });

        //Get Calendar Names from the service(Not working)
       /* 
        this.federateService.getCalendarNames().subscribe((results)=>{
            for(var i=0; i< Object.keys(results).length; i++){
                $('<option></option>').appendTo('.calendar-names').attr("value", results[i]).text(results[i]);
            }
        },(error)=>{})*/


    }

    protected closeModal() { }

    public open(queryID: string) {
        this.queryID = queryID;
        this.queryIDField.val(queryID);
        super.openModal();
    }

    //Get the Query and perform MD5
    public openFromQuery(query: string){
        super.openModal();
        var md5 = require('md5');
        let md_val = md5(query);
        if(query == ''){
            $('.query-id').val('');
        }
        else{
            $('.query-id').val(md_val);
            $('.sql-query').val(query);
        }        

    }

    scheduleQuery(){
        //required fields
        var job_nm = $('.job-name').val();
        var queryid = $('.query-id').val();
        var query_name = $('.sql-query').val();
        var calendarnm = $('.calendar-names option:selected').text();
        var schedule_nm = $('.schedule-names option:selected').text();
        var job_template = $('.template-names option:selected').text();
        var job_eff_strt_dt = $('.job-eff-start-dt').val();
        var sch_eff_strt_dt = $('.sch-eff-start-dt').val();
        var sch_strt_tm = $('.sch-start-tm').val() + ':00';
        var sla_strt_tm = $('.sla-start-tm').val() + ':00';
        var sla_end_tm = $('.sla-end-tm').val() + ':00';
        var sla_offset_day_count = $('.sla-offset-day-count').val();
       
        //optional fields
        var predecessor_cond = $('.pred-cond').val();
        var predecessor_cond_type = $('.pred-cond-type').val();
        var support_group_email = $('.support-group-email').val();
        var frequency = $('.frequency-names option:selected').text();
        var job_priority_num = $('.job-priority-number').val();
        var maximum_run_alarm_seconds_count = $('.max-run-alarm-number').val();
        var minimum_run_alarm_seconds_count= $('.min-run-alarm-number').val();
        var critical_job_ind = $('.crtical-job-ind option:selected').text();
        var financial_penality_ind = $('.financial-pen-ind option:selected').text();
        var create_dag_ind = $('.create-dag-ind option:selected').text();
        //extra fields

        var next_buss_ind = $('.bst-names option:selected').text();
        this.federateService.scheduleSavedQuery(job_nm,queryid,query_name,calendarnm,schedule_nm,job_template,job_eff_strt_dt,sch_eff_strt_dt,sch_strt_tm,sla_strt_tm,sla_end_tm,sla_offset_day_count, predecessor_cond,predecessor_cond_type,support_group_email,frequency,job_priority_num,maximum_run_alarm_seconds_count,minimum_run_alarm_seconds_count,critical_job_ind,financial_penality_ind,create_dag_ind,next_buss_ind).subscribe((results)=>{
            $('.Scheduled-status').empty();
            $('.Scheduled-status').removeClass("alert alert-danger");
            $('.Scheduled-status').addClass("alert alert-success");
           $('.Scheduled-status').html('Successfully Scheduled')
        },(error)=>{
            $('.Scheduled-status').empty();
            $('.Scheduled-status').removeClass("alert alert-success");
            $('.Scheduled-status').addClass("alert alert-danger");
            $('.Scheduled-status').html('Failed to Schedule')
        })
    }

    
}
