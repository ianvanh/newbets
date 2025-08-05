require("dotenv")
module.exports = {
  info: {
    author: 'IanVanh',
    name_page: 'NewBets',
    desc: 'Newbets, la mejor forma de ganarle al sistema, analisis de expertos, las mejores cuotas. Únete a la comunidad de apuestas deportivas más grande.',
    dominio: 'https://newbets.onrender.com'
  },
  github: {
    token: process.env.GITHUB_TOKEN || ''
  },
  PORT: process.env.PORT || 3000,
  SECRET: process.env.SECRET || ''
};