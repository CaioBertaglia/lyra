import { EventBus } from './core/event-bus.js';
import { StorageService } from './services/storage.service.js';
import { SpotifyController } from './controllers/spotify.controller.js';

StorageService.migrate();

SpotifyController.init();

console.log('Lyra iniciado');

EventBus.emit('app:ready');