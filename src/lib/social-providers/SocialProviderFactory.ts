import { ISocialProvider } from './social-provider-types';
import { SimulatedSocialProvider } from './providers/SimulatedProvider';

export class SocialProviderFactory {
  static getProvider(platform: string, simulated: boolean): ISocialProvider {
    // Under local simulation or development, return the SimulatedSocialProvider.
    // Real adapters (MetaProvider, LinkedInProvider, XProvider) will be mapped here as they are integrated.
    if (simulated) {
      return new SimulatedSocialProvider(platform);
    }
    
    // Default fallback to SimulatedProvider during current Phase 1 development
    return new SimulatedSocialProvider(platform);
  }
}
