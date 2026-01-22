import Image from 'next/image';

const storeLinks = {
  android: 'https://play.google.com/store/apps/details?id=com.smartsapp&hl=en',
  ios: 'https://apps.apple.com/us/app/smartsapp/id1544420000',
  huawei: 'https://appgallery.huawei.com/#/app/C103443309',
};

const AppStoreButtons = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <a href={storeLinks.android} target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
        <Image src="https://smartsapp.com/wp-content/uploads/2021/04/google-play-badge.png" alt="Get it on Google Play" width={162} height={48} className="h-12 w-auto" />
      </a>
      <a href={storeLinks.ios} target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
        <Image src="https://smartsapp.com/wp-content/uploads/2021/04/apple-store-badge.png" alt="Download on the App Store" width={162} height={48} className="h-12 w-auto" />
      </a>
      <a href={storeLinks.huawei} target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
        <Image src="https://smartsapp.com/wp-content/uploads/2021/04/huawei-app-gallery.png" alt="Explore it on AppGallery" width={162} height={48} className="h-12 w-auto" />
      </a>
    </div>
  );
};

export default AppStoreButtons;
