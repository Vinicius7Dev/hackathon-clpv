import axios from 'axios';

import config from '../../config.js';

const api = axios.create({
  baseURL: config.API_URL,
});

export default api;
