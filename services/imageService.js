const axios = require('axios');
const fs = require('fs');
const path = require('path');

const headers = {
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'https://www.sofascore.com/'
};

exports.downloadTeamLogo = async (teamId) => {
  try {
    const response = await axios.get(`https://api.sofascore.com/api/v1/team/${teamId}/image`, {
      headers,
      responseType: 'arraybuffer'
    });
    return response.data;
  } catch (error) {
    console.error(`Error downloading logo for team ${teamId}:`, error.message);
    return null;
  }
};