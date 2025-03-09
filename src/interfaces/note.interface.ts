import { EditLog, EditTools } from './entry.interface';

export type Note = {
    id?: string;
    content: string;
    path: string;
    editLog: EditLog[];
};
export type NoteTools = Omit<EditTools, 'DAYLIO' | 'DAYLIO_IMPORT' | 'WEB'>;
