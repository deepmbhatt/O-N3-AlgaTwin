require('dotenv').config();
const express=require('express')
const app=express();
const PORT=process.env.PORT || 3000;
const cors=require('cors')
const routes=require('./routes/index')
const bodyParser=require('body-parser')
const {dbconnection} = require('./db')
const {STATUS_CODE}=require('./utils/constants')
const {sendErrorResponse}=require('./utils/response')


dbconnection();


app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//Middleware to parse JSON and URL-encoded data


app.use('/api',routes)

app.use((err, req, res, next) => {
  console.log(err)
  return sendErrorResponse(
    res,
    {},
    err.message,
    err.statusCode || STATUS_CODE.INTERNAL_SERVER_ERROR
  );
});



app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});