import { NativeModule, registerWebModule } from 'expo';

// En la web no existe la alarma nativa de Android.
class AlarmOverlayModule extends NativeModule<Record<string, never>> {}

export default registerWebModule(AlarmOverlayModule, 'AlarmOverlay');
