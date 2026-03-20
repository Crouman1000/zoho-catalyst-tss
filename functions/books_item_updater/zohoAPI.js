const oauth2 = require("./oauth2.js");
let accessToken = process.env.ACCESS_TOKEN;


async function zohoHttpReq(url,type,data) {

    const options = {
        method: type,
        headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`
        } 
    }

    if(["POST", "PUT"].includes(type)){
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
    }

    let res = await fetch(url, options);

    if(!res.ok && [401, 403].includes(res.status)){
        
        accessToken = await oauth2.zohoAuthenticate();

        options.headers.Authorization = `Zoho-oauthtoken ${accessToken}`;

        if(!accessToken){
            throw new Error("zohoAuthenticate() failed at retrieving an access token");
        }
        
        res = await fetch(url, options);      
    }
    
    if(!res.ok){
        const body = await res.text().catch(() => null);
        throw new Error(`Zoho API failed: ${body}`);
    }

    return await res.json();
        
} 



module.exports = {zohoHttpReq};