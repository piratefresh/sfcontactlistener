import "dotenv-safe/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import jsforce from "jsforce";
import { AuthenticationClient, ManagementClient } from "auth0";

const auth0 = new AuthenticationClient({
  domain: process.env.AUTH0_DOMAIN as string,
  clientId: process.env.AUTH0_CLIENT_ID as string,
});

const management = new ManagementClient({
  clientId: process.env.AUTH0_CLIENT_ID as string,
  clientSecret: process.env.AUTH0_CLIENT_SECRET as string,
  domain: process.env.AUTH0_DOMAIN as string,
  scope:
    "read:users update:users delete:users create:users read:users_app_metadata delete:users_app_metadata",
});

const main = async () => {
  const conn = new jsforce.Connection({});
  const app = express();
  await conn.login(
    process.env.SF_USERNAME as string,
    process.env.SF_PASSWORD as string,
    async () => {
      console.log("Authenticated");

      await conn.streaming
        .topic("ContactsUpdates2")
        .subscribe(async (message: any) => {
          if (message) {
            console.log("message: ", message);

            if (auth0.database && message.event.type === "created") {
              console.log("adding user to database");
              const response = await auth0.database.signUp({
                connection: "Username-Password-Authentication",
                email: message.sobject.Email,
                given_name: message.sobject.FirstName,
                family_name: message.sobject.LastName,
                name: `${message.sobject.FirstName} ${message.sobject.LastName}`,
                password: "setvi2020",
                email_verified: true,
                // picture: "http://example.org/jdoe.png",
                user_metadata: {
                  sfid: message.sobject.Id,
                  pricebook_id: message.sobject.PriceBook__c,
                  cart_id: message.sobject.Cart__c,
                  address:
                    message.sobject.MailingAddress ??
                    message.sobject.MailingAddress,
                  otherAddress:
                    message.sobject.OtherAddress ??
                    message.sobject.OtherAddress,
                },
              });
              if (response) {
                auth0.requestChangePasswordEmail({
                  connection: "Username-Password-Authentication",
                  email: response.email as string,
                });
                console.log("response: ", response);
                return response;
              }
              return "Created Account";
            } else if (auth0.database && message.event.type === "updated") {
              console.log("UPDATING CONTACT");
              const params = {
                search_engine: "v3",
                q: `user_metadata.sfid:"${message.sobject.Id}"`,
              };

              const metadata = {
                sfid: message.sobject.Id,
                pricebook_id: message.sobject.Price_Book__c,
                cart_id: message.sobject.Cart__c ? message.sobject.Cart__c : "",
                address:
                  message.sobject.MailingAddress ??
                  message.sobject.MailingAddress,
                otherAddress:
                  message.sobject.OtherAddress ?? message.sobject.OtherAddress,
              };
              const user = await management.getUsers(params);

              console.log("user: ", user);
              management.updateUserMetadata(
                {
                  id: user[0].user_id as string,
                },
                metadata,
                (user, error) => {
                  if (error) {
                    console.log(error);
                  }
                  console.log(user);
                }
              );
            } else if (message.event.type === "deleted") {
              const params = {
                search_engine: "v3",
                q: `user_metadata.sfid:"${message.sobject.Id}"`,
              };

              const user = await management.getUsers(params);
              const deleteResponse = await management.deleteUser({
                id: user[0].user_id as string,
              });
              return deleteResponse;
            } else {
              return "user exists";
            }
          }

          return message;
        });
    }
  );
  app.use(morgan("combined"));

  app.use(cors());

  app.post("/webooktest2", function (request, response) {
    console.log("Test", request); // your JSON
    response.send(request.body); // echo the result back
  });

  app.listen(parseInt(process.env.PORT as string), () => {
    console.log("server started on localhost:4000");
  });
};

main().catch((err) => {
  console.error(err);
});
