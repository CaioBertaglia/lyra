import { EventBus } from './core/event-bus.js';
import { StorageService } from './services/storage.service.js';

StorageService.migrate();

console.log('Lyra iniciado');

EventBus.emit('app:ready');