import db from "../database/connection";
import convertHoursToMinutes from "../utils/convertHoursToMinutes";
import { Request, Response } from "express";

interface ScheduleItem {
    week_day: number,
    from: string,
    to: string

}

export default class ClassesController {

    async index(request: Request, response: Response) {
        const filters = request.query;

        const subject = filters.subject as string;
        const week_day = filters.week_day as string;
        const time = filters.time as string;

        if (!subject || !week_day || !time) {
            return response.status(400).json({
                error: 'Os filtros são obrigatórios'
            })
        }

        const timeInMinutes = convertHoursToMinutes(filters.time as string);

        const classes = await db('classes')
            .whereExists(function() {
                this.select('classes_schedule.*')
                    .from('classes_schedule')
                    .whereRaw('`classes_schedule`.`class_id` = `classes`.`id`')
                    .whereRaw('`classes_schedule`.`week_day` = ??', [Number(week_day)])
                    .whereRaw('`classes_schedule`.`from` <= ??', [Number(timeInMinutes)])
                    .whereRaw('`classes_schedule`.`to` > ??', [Number(timeInMinutes)])
            })
            .join('users', 'classes.user_id', '=', 'users.id')
            .where('classes.subject', '=', subject)
            .select(['classes.*', 'users.*']);

        return response.json(classes);
        
    }

    async create (request: Request, response: Response) {
        const {name, avatar, whatsapp, bio, subject, cost, schedule} = request.body;
    
        const trx = await db.transaction();
    
        try {
            const insertedUsersIds = await trx('users').insert({
                name,
                avatar,
                whatsapp,
                bio
            });
        
            const user_id = insertedUsersIds[0];
        
            const insertedClassesId = await trx('classes').insert({
                subject,
                cost,
                user_id
            })
        
            const class_id = insertedClassesId[0];
        
            const classSchedule = schedule.map((scheduleItem:ScheduleItem) => {
                return {
                    class_id,
                    week_day: scheduleItem.week_day,
                    from: convertHoursToMinutes(scheduleItem.from),
                    to: convertHoursToMinutes(scheduleItem.to),
                };
            })
        
            await trx('classes_schedule').insert(classSchedule);
        
            await trx.commit();
        
            return response.status(201).send();
        } catch (err) {
            await trx.rollback();
            return response.status(400).json({
                error: 'Ocorreu um erro inesperado ao criar uma aula'
            })
        }
        
    }
}