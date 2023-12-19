import { addSeconds } from 'date-fns';

declare global {
    interface Window {
        gapi: any;
    }
}
export class GoogleDriveService {
    constructor(public onReadyCallback = () => {}) {
        this.loadGoogleDependencies();
    }
    tokenClient: any;
    init(tokenClient: any) {
        this.tokenClient = tokenClient;
    }

    CLIENT_ID!: string;
    API_KEY!: string;
    DISCOVERY_DOC =
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
    SCOPES =
        'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile';

    gapiLoaded = async () => {
        window.gapi.load('client', this.initializeGapiClient);
    };
    initializeGapiClient = async () => {
        await window.gapi.client.init({
            apiKey: this.API_KEY,
            discoveryDocs: [this.DISCOVERY_DOC],
        });
        this.onReadyCallback();
    };
    gisLoaded = () => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
        });
        this.init(tokenClient);
    };
    private loadGoogleDependencies() {
        this.CLIENT_ID = `${import.meta.env.VITE_GCLIENT_ID}`;
        this.API_KEY = `${import.meta.env.VITE_GAPI_KEY}`;

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.onload = this.gapiLoaded;
        script.src = 'https://apis.google.com/js/api.js';
        document.getElementsByTagName('head')[0].appendChild(script);
        const script2 = document.createElement('script');
        script2.type = 'text/javascript';
        script2.async = true;
        script2.onload = this.gisLoaded;
        script2.src = 'https://accounts.google.com/gsi/client';
        document.getElementsByTagName('head')[0].appendChild(script2);
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
            if (window.gapi?.client && new Date(token.expiry) > now) {
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
