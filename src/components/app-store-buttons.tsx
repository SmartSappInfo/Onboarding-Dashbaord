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
        <Image src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" width={300} height={89} className="h-12 w-auto" />
      </a>
      <a href={storeLinks.ios} target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
        <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Download_on_the_App_Store_Badge.svg/1280px-Download_on_the_App_Store_Badge.svg.png" alt="Download on the App Store" width={1280} height={430} className="h-12 w-auto" />
      </a>
      <a href={storeLinks.huawei} target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
        <Image src="https://smartsapp.com/wp-content/uploads/2021/04/huawei-app-gallery.png" alt="Explore it on AppGallery" width={162} height={48} className="h-12 w-auto" />
      </a>
    </div>
  );
};

export default AppStoreButtons;
