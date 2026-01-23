import Image from 'next/image';

const storeLinks = {
  android: 'https://play.google.com/store/apps/details?id=com.smartsapp&hl=en',
  ios: 'https://apps.apple.com/us/app/smartsapp/id1544420000',
  huawei: 'https://appgallery.huawei.com/#/app/C103443309',
};

const AppStoreButtons = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <a href={storeLinks.android} target="_blank" rel="noopener noreferrer" className="relative block h-12 w-36 transition-transform hover:scale-105">
        <Image 
          src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
          alt="Get it on Google Play" 
          fill 
          sizes="144px"
          style={{objectFit: "contain"}}
        />
      </a>
      <a href={storeLinks.ios} target="_blank" rel="noopener noreferrer" className="relative block h-12 w-36 transition-transform hover:scale-105">
        <Image 
          src="https://smartsapp.com/wp-content/uploads/2021/04/app-store.png" 
          alt="Download on the App Store" 
          fill
          sizes="144px"
          style={{objectFit: "contain"}}
        />
      </a>
      <a href={storeLinks.huawei} target="_blank" rel="noopener noreferrer" className="relative block h-12 w-36 transition-transform hover:scale-105">
        <Image 
          src="https://smartsapp.com/wp-content/uploads/2021/04/huawei-app-gallery.png" 
          alt="Explore it on AppGallery" 
          fill
          sizes="144px"
          style={{objectFit: "contain"}}
        />
      </a>
    </div>
  );
};

export default AppStoreButtons;
