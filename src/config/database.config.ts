export default () => ({
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'auth_db',
    synchronize: process.env.DB_SYNCHRONIZE === 'true' || false,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'There should be an secert key in the ENV',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
});
