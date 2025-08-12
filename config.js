require("dotenv")
module.exports = {
  info: {
    author: 'IanVanh',
    name_page: 'NewBets',
    desc: 'Newbets, la mejor forma de ganarle al sistema, mejores analisis, las mejores cuotas. Únete a nuestra comunidad de apuestas deportivas.',
    dominio: 'https://newbets.onrender.com',
    fb_app_id: '1705732760145734',
    logo: 'banner'
  },
  github: {
    token: process.env.GITHUB_TOKEN || ''
  },
  PORT: process.env.PORT || 3000,
  SECRET: process.env.SECRET || ''
};