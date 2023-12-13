import { addSeconds } from 'date-fns';

export class GoogleDriveService {
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
                            'Bearer ' + gapi.auth.getToken().access_token,
                    }),
                    body: form,
                }
            );
            let json = await res.json();
            console.log(json);
            return json.id;
        } catch (err) {
            console.log(err);
        }
    }
    public async deleteFile(id: string) {
        return await gapi.client.drive.files.delete({
            fileId: id,
        });
    }
    public async listFolder() {
        let response;
        try {
            response = await gapi.client.drive.files.list({
                spaces: 'appDataFolder',
                fields: 'nextPageToken, files(id, name, createdTime, description)',
            });
        } catch (err) {
            console.log(err);
        }
        const files = response.result.files;
        return files;
    }
    public async getFile(id: string) {
        return await gapi.client.drive.files.get({
            fileId: id,
            alt: 'media',
        });
    }

    public hasValidToken(): boolean {
        const now = new Date();
        if (gapi.client.getToken() && gapi.client.getToken().expiry > now)
            return true;
        else if (localStorage.getItem('gapi_token')) {
            const token = JSON.parse(localStorage.getItem('gapi_token') || '');
            if (new Date(token.expiry) > now) {
                gapi.client.setToken(token);
                return true;
            }
        } else {
            return false;
        }
    }
    public async authenticate(callback = () => {}) {
        console.log(tokenClient);
        tokenClient.callback = async (resp: any) => {
            if (resp.error !== undefined) {
                throw resp;
            }
            resp.expiry = addSeconds(new Date(), resp.expires_in);
            gapi.client.setToken(resp);
            localStorage.setItem('gapi_token', JSON.stringify(resp));
            callback();
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
    public async getUserInfo(): Promise<{ name: string; picture: string }> {
        const resp = await fetch(
            `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${
                gapi.client.getToken().access_token
            }`
        );
        return await resp.json();
    }
}
