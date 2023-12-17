import { addSeconds } from 'date-fns';

declare global {
    interface Window {
        gapi: any;
    }
}
export class GoogleDriveService {
    tokenClient: any;
    init(tokenClient: any) {
        this.tokenClient = tokenClient;
    }
    public async addFile(
        name: string,
        content: string,
        description: string,
        type: string = 'application/json'
    ) {
        var fileMetadata = {
            name,
            description,
            parents: ['appDataFolder'],
        };
        var fileContent = new Blob([content], { type });

        try {
            const form = new FormData();
            form.append(
                'metadata',
                new Blob([JSON.stringify(fileMetadata)], {
                    type: 'application/json',
                })
            );
            form.append('file', fileContent);
            let res = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: new Headers({
                        Authorization:
                            'Bearer ' +
                            window.gapi.auth.getToken().access_token,
                    }),
                    body: form,
                }
            );
            let json = await res.json();
            return json.id;
        } catch (err) {
            console.error(err);
        }
    }
    public async deleteFile(id: string) {
        return await window.gapi.client.drive.files.delete({
            fileId: id,
        });
    }
    public async listFolder() {
        let response;
        try {
            response = await window.gapi.client.drive.files.list({
                spaces: 'appDataFolder',
                fields: 'nextPageToken, files(id, name, createdTime, description)',
            });
        } catch (err) {
            console.error(err);
        }
        const files = response.result.files;
        return files;
    }
    public async getFile(id: string) {
        return await window.gapi.client.drive.files.get({
            fileId: id,
            alt: 'media',
        });
    }

    public hasValidToken(): boolean {
        const now = new Date();
        if (
            window.gapi?.client?.getToken() &&
            window.gapi?.client?.getToken()?.expiry > now
        )
            return true;
        else if (localStorage.getItem('gapi_token')) {
            const token = JSON.parse(localStorage.getItem('gapi_token') || '');
            if (new Date(token.expiry) > now) {
                window.gapi.client.setToken(token);
                return true;
            }
        }
        return false;
    }
    public async authenticate(callback = () => {}) {
        this.tokenClient.callback = async (resp: any) => {
            if (resp.error !== undefined) {
                throw resp;
            }
            resp.expiry = addSeconds(new Date(), resp.expires_in);
            window.gapi.client.setToken(resp);
            localStorage.setItem('gapi_token', JSON.stringify(resp));
            callback();
        };
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    }
    public async getUserInfo(): Promise<{ name: string; picture: string }> {
        const resp = await fetch(
            `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${
                window.gapi.client.getToken().access_token
            }`
        );
        return await resp.json();
    }
}
