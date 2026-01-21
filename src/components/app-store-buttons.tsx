import { Button } from './ui/button';
import { GooglePlayIcon, AppleAppStoreIcon, HuaweiAppGalleryIcon } from './icons';

const storeLinks = {
  android: 'https://play.google.com/store/apps/details?id=com.smartsapp&hl=en',
  ios: 'https://apps.apple.com/us/app/smartsapp/id1544420000',
  huawei: 'https://appgallery.huawei.com/#/app/C103443309',
};

const AppStoreButtons = () => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row justify-center">
      <Button variant="outline" size="lg" asChild className="justify-start">
        <a href={storeLinks.android} target="_blank" rel="noopener noreferrer">
          <GooglePlayIcon className="mr-3 h-6 w-6" />
          <div>
            <div className="text-xs">GET IT ON</div>
            <div className="text-lg font-semibold -mt-1">Google Play</div>
          </div>
        </a>
      </Button>
      <Button variant="outline" size="lg" asChild className="justify-start">
        <a href={storeLinks.ios} target="_blank" rel="noopener noreferrer">
          <AppleAppStoreIcon className="mr-3 h-6 w-6" />
          <div>
            <div className="text-xs">Download on the</div>
            <div className="text-lg font-semibold -mt-1">App Store</div>
          </div>
        </a>
      </Button>
      <Button variant="outline" size="lg" asChild className="justify-start">
        <a href={storeLinks.huawei} target="_blank" rel="noopener noreferrer">
          <HuaweiAppGalleryIcon className="mr-3 h-6 w-6" />
          <div>
            <div className="text-xs">EXPLORE IT ON</div>
            <div className="text-lg font-semibold -mt-1">AppGallery</div>
          </div>
        </a>
      </Button>
    </div>
  );
};

export default AppStoreButtons;
