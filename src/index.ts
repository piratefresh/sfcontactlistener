import "dotenv-safe/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import jsforce from "jsforce";
import { AuthenticationClient } from "auth0";

const auth0 = new AuthenticationClient({
  domain: process.env.AUTH0_DOMAIN as string,
  clientId: process.env.AUTH0_CLIENT_ID as string,
});

// const management = new ManagementClient({
//   clientId: process.env.AUTH0_CLIENT_ID as string,
//   clientSecret: process.env.AUTH0_CLIENT_SECRET as string,
//   domain: process.env.AUTH0_DOMAIN as string,
//   scope: "read:users update:users delete:users",
// });

const main = async () => {
  const conn = new jsforce.Connection({});
  const app = express();
  await conn.login(
    process.env.SF_USERNAME as string,
    process.env.SF_PASSWORD as string,
    async () => {
      console.log("Authenticated");

      await conn.streaming
        .topic("ContactsUpdates")
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
                email_verified: false,
                // picture: "http://example.org/jdoe.png",
                user_metadata: {
                  sfid: message.sobject.Id,
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

  app.listen(parseInt(process.env.PORT), () => {
    console.log("server started on localhost:4000");
  });
};

main().catch((err) => {
  console.error(err);
});
