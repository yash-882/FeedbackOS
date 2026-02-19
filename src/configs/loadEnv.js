// load environment variables
import dotenv from 'dotenv';

export default function loadEnv(){
        dotenv.config({quiet: true});
}

loadEnv();