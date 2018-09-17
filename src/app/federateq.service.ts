import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import * as AWS from 'aws-sdk/global';
import * as S3 from 'aws-sdk/clients/s3';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/throw';

declare var $: any;

@Injectable()
export class FederateqService {
    public static readonly hostip: string = 'http://52.22.85.175:5000';

    constructor(private http: HttpClient) { }

    /**
     * Send a GET request to the FederateqService hostip with the given path.
     * @param path 
     */
    private request(path): Observable<any> {
        return this.http.get<any>(FederateqService.hostip + path).catch(this.handleError);
    }

    /**
     * Get the Federated Query JSON Data by passing the Query String.
     */
    public getFederatedata(query): Observable<any> {
        return this.request('/query?sql=' + query);
    }

    /**
     * Get the federated Query with Conditions.
     */
    public getFederatedataConditions(query, conditions): Observable<any> {
        return this.request('/query?sql=' + query + '&conditions=' + conditions);
    }

    /**
     * Save the table data to different file formats.
     */
    public setFederatedTableDifFileFormats(query): Observable<any> {
        return this.request('/api/s3/upload?sql=' + query);
    }

    /**
     * Get the history of a query for a user.
     */
    public getFederatedQueryHistory(): Observable<any> {
        return this.request('/api/history');
    }

    /**
     * Run a query from the history
     */
    public getFederationHistoryQuery(query, starttime): Observable<any> {
        return this.request('/api/query/result_file?sql=' + query + '&timestamp=' + starttime);
    }
    /**
     * Get scheduled Queries information for a user
     */

    public getScheduledQueryInfo():Observable<any>{
        return this.request('/scheduledqueries');
    }
    /**
     * Get the Results of a Scheduled Query
     */
    public getScheduledQueryresults(jobnm):Observable<any>{
        return this.request('/api/query/results/scheduler?job_name='+jobnm);
    }
    /**
     * Get the saved queries for a user.
     */
    public getFederatedSavedQuery(): Observable<any> {
        return this.request('/api/show/saved_query');
    }

    /**
     * Get a name for saved queries for a user.
     */
    public getFederatedSavedQueryname(query, purpose, name): Observable<any> {
        return this.request('/api/savequery?sql=' + query + '&qry_prps=' + purpose + '&qry_nm=' + name);
    }

    /**
     * Generate TDE File.
     */
    public generateTDEfile(query): Observable<any> {
        return this.request('/tde?sql=' + query);
    }

    /**
     *  Schedule a Query on button click.
     */
    public queryToSchedule(querystring): Observable<any> {
        return this.request('/schedule?sql=' + querystring);
    }

    /**
     *  Get all Calendar names to Schedule a Query.
     */
    public getCalendarNames(): Observable<string[]> {
        return this.request('/calendar_name');
    }

    /**
     *  Get all Template names to Schedule a Query.
     */
    getTemplateNames(): Observable<string[]> {
        return this.request('/template');
    }

    /**
     * Error handling.
     */
    handleError(error) {
        return Observable.throw(error)
    }

    /**
     * Schedule a Saved Query.
     */
    scheduleSavedQuery(job_nm,queryid,query_name,calendarnm,schedule_nm,job_template,job_eff_strt_dt,sch_eff_strt_dt,sch_strt_tm,sla_strt_tm,sla_end_tm,sla_offset_day_count, predecessor_cond,predecessor_cond_type,support_group_email,frequency,job_priority_num,maximum_run_alarm_seconds_count,minimum_run_alarm_seconds_count,critical_job_ind,financial_penality_ind,create_dag_ind,next_buss_ind): Observable<any> {
        console.log(
            {
                job_name: job_nm,
                queryid: queryid,
                query_name: query_name,
                calendarnm: calendarnm,
                schedule_nm: schedule_nm,
                job_template: job_template,
                job_eff_strt_dt: job_eff_strt_dt,
                sch_eff_strt_dt: sch_eff_strt_dt,
                sch_strt_tm: sch_strt_tm,
                sla_strt_tm: sla_strt_tm,
                sla_end_tm: sla_end_tm,
                sla_offset_day_count: sla_offset_day_count,
                predecessor_cond: predecessor_cond,
                predecessor_cond_type:predecessor_cond_type,
                support_group_email:support_group_email,
                frequency:frequency,
                job_priority_num:job_priority_num,
                maximum_run_alarm_seconds_count:maximum_run_alarm_seconds_count,
                minimum_run_alarm_seconds_count:minimum_run_alarm_seconds_count,
                critical_job_ind:critical_job_ind,
                financial_penality_ind:financial_penality_ind,
                create_dag_ind:create_dag_ind,
                next_buss_ind: next_buss_ind
            }
        );
        return this.http.post(FederateqService.hostip + '/queryscheduler', {
            job_name: job_nm,
            queryid: queryid,
            query_name: query_name,
            calendarnm: calendarnm,
            schedule_nm: schedule_nm,
            job_template: job_template,
            job_eff_strt_dt: job_eff_strt_dt,
            sch_eff_strt_dt: sch_eff_strt_dt,
            sch_strt_tm: sch_strt_tm,
            sla_strt_tm: sla_strt_tm,
            sla_end_tm: sla_end_tm,
            sla_offset_day_count: sla_offset_day_count,
            predecessor_cond: predecessor_cond,
            predecessor_cond_type:predecessor_cond_type,
            support_group_email:support_group_email,
            frequency:frequency,
            job_priority_num:job_priority_num,
            maximum_run_alarm_seconds_count:maximum_run_alarm_seconds_count,
            minimum_run_alarm_seconds_count:minimum_run_alarm_seconds_count,
            critical_job_ind:critical_job_ind,
            financial_penality_ind:financial_penality_ind,
            create_dag_ind:create_dag_ind,
            next_buss_ind: next_buss_ind,
        }).catch(this.handleError);
    }

    /**
     * Send data to s3 bucket.
     */
    uploadfile(file) {

        const bucket = new S3(
            {
                accessKeyId: 'AKIAJJPZKCHSKBVKIEVA',
                secretAccessKey: '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',
                region: 'us-east-1'
            }
        );

        const params = {
            Bucket: 'cod-bucket',
            Key: file.name,
            Body: file,
            ACL: 'public-read'
        };

        bucket.upload(params, function (err, data) {
            if (err) {
                $('#dissbktmsg').removeClass("alert alert-success");
                $('#dissbktmsg').addClass("alert alert-danger");
                $('#dissbktmsg').html("<strong>There was an error uploading your file</strong>");

                return false;
            }
            $('#dissbktmsg').removeClass("alert alert-danger");
            $('#dissbktmsg').addClass("alert alert-success");
            $('#dissbktmsg').html("<strong>Successfully uploaded file to cod-bucket.</strong>");

            return true;
        });
    }
}
