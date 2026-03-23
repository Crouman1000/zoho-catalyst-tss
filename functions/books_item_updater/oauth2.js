const auth_url = "https://accounts.zoho.com/oauth/v2/token";
const scope = "ZohoBooks.fullaccess.all";
const method = "POST";

///@@@ Issue with catalyst deploy deleting predefined env variables on the catalyst web app.
//  hardcoding values for client_id and client_secret here solves it, but is unsafe
async function zohoAuthenticate(){

    const res = await fetch(auth_url, {

        method: method,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: "client_credentials",
            scope: scope
        }).toString(),

    });

    const data = await res.json();
    //console.log(`Zoho OAuth response: ${JSON.stringify(data)}`);

    if(data.error){
        throw new Error(data.error || "Zoho OAuth failed");
    }

    //process.env.ACCESS_TOKEN = data.access_token;
    return data.access_token;
}

module.exports = {zohoAuthenticate};