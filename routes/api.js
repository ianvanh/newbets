const express = require('express');
const router = express.Router();
const matchesController = require('../controllers/matchesController');

// admin
router.get('/preview-match', matchesController.previewMatch);
router.get('/check-match/:eventId', matchesController.checkMatch);
router.post('/save-matches', matchesController.saveMatches);
router.get('/team-logo/:teamId', matchesController.getTeamLogo);

router.get('/database', matchesController.result);

// update scores
router.post('/view-data', matchesController.update);
router.post('/view-data2', matchesController.update2);

// pronosticos
router.get('/pronosticos', matchesController.getPronosticosData);
router.get('/cache', matchesController.updateCache);
router.get('/cache2', matchesController.updateCache2);

module.exports = router;