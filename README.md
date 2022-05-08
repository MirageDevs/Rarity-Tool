# Mirage Rarity Tool

1. This is a tool for analyzing the Rarity of NFT collections on Oasis.
2. The tool along with UI can be seen here - http://157.230.2.210/
3. Near the release, it will be rarity.mirage.market

## How to run it

1. Clone this repo and open the folder in Visual Studio Code
2. On the terminal, do 'npm install' to install the required dependencies
3. Do 'npm start' next which will start it on localhost:3001


## Add a collection

1. Since right now, there is no collection added, we will have to add it by using Postman (It can be downloaded from https://www.postman.com/)
2. Once Postman is downloaded, Go to APIs and select New. Select HTTP Request from the options
<img width="1114" alt="Screen Shot 2022-04-27 at 10 37 30 PM" src="https://user-images.githubusercontent.com/99606439/165665538-f96c0b57-7845-4bcc-a790-33e6b37b5406.png">
3. Change it to POST request (By default it creates a GET request)
4. In the URL paste this - http://localhost:3001/api/add
5. Go to BODY section and select form-data
6. Add 2 keys namely "collection" and "config" and change their types to File (From the dropdown next to their names)
7. For the collection key select oasisDoodles.json from the config folder in this repo
8. For the config key select oasisDoodles_config.js from the config folder in this repo
9. Once selected, it should look like this - 
<img width="828" alt="Screen Shot 2022-04-27 at 10 27 26 PM" src="https://user-images.githubusercontent.com/99606439/165664295-fa44f03a-8e73-4183-b5eb-a805fc638562.png">
10. Click on "SEND" button.
11. This creates the required sqlite for the collection which consists of all the tables containing rarity scores and other required information

## Viewing the results
1. Once the addition of collection is successful, you can open Firefox and paste this "http://localhost:3001/api/oasisDoodles" to see the collection details.
<img width="1036" alt="Screen Shot 2022-04-27 at 10 33 05 PM" src="https://user-images.githubusercontent.com/99606439/165664878-1376255d-6022-4015-9816-a28e99d88c5f.png">


3. You can also go to "http://localhost:3001/api/oasisDoodles/12" or any image just by changing the number at the end and looking at its rarity score and other details
<img width="819" alt="Screen Shot 2022-04-27 at 10 32 55 PM" src="https://user-images.githubusercontent.com/99606439/165664899-695c94b2-73dd-4f5a-9fb2-ccf448b7673a.png">

4. You can also see that there is a file named "oasisDoodles.sqlite" in the config folder.
5. You can upload this sqlite database file on "https://sqliteonline.com/" and check what all tables are there in the database along with its values with basic queries

<img width="1091" alt="Screen Shot 2022-04-27 at 10 36 01 PM" src="https://user-images.githubusercontent.com/99606439/165665421-ad60afba-e7e8-45ab-b13d-34396aa5373a.png">


## SQL Injection vulnerabilities 
SQL Injection Vulnerabilities have been handled for all the APIs by checking if the passing parameters exist or not in our server. In that way, even if the user tries to pass `DROP * from Collection` as a parameter it would check whether the given parameters exists instead of directly passing into our SQL queries.


/api/collectionName returns all the data related to given collectionName

For Example - /api/InvalidCollectionName (where InvalidCollectionName can be anything here)
If Given Collection Name doesn’t exist, it will throw an error
If given collection name is a sql query, it is still preventing as it would make a check whether the Collection Name config files exists or not, so before it fetches or queries it will throw an error stating Invalid Collection Name

/api/add required a username which is a secret key used by the team to add a new collection. No one from the outside world can access this without having the right username key

## Expected Workflow:

Customer logs on to the platform and accesses the Google form link to apply for Rarity tool ( https://docs.google.com/forms/u/4/d/e/1FAIpQLScwk5-Cziyxng_aSKWcbpoH9tL2fcY2Y3s1osnBDnWpQPi2pw/viewform?usp=send_form) 

We manually check the metadata, verify the details with collection owners and Upload. 

1) Add collection function has a secret username/password combination for the admin team.
2) External teams cannot access the data. 
3) We make the collection live on our platform for the end users. 

