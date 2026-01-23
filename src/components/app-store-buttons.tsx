import Image from 'next/image';

const storeLinks = {
  android: 'https://play.google.com/store/apps/details?id=com.smartsapp&hl=en',
  ios: 'https://apps.apple.com/us/app/smartsapp/id1544420000',
  huawei: 'https://appgallery.huawei.com/#/app/C103443309',
};

const AppStoreButtons = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <a href={storeLinks.android} target="_blank" rel="noopener noreferrer" className="relative block h-14 w-44 transition-transform hover:scale-105">
        <Image 
          src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
          alt="Get it on Google Play" 
          fill 
          sizes="176px"
          style={{objectFit: "contain"}}
        />
      </a>
      <a href={storeLinks.ios} target="_blank" rel="noopener noreferrer" className="relative block h-14 w-44 transition-transform hover:scale-105">
        <Image 
          src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" 
          alt="Download on the App Store" 
          fill
          sizes="176px"
          style={{objectFit: "contain"}}
        />
      </a>
      <a href={storeLinks.huawei} target="_blank" rel="noopener noreferrer" className="relative block h-14 w-44 transition-transform hover:scale-105">
        <Image 
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Download-on-the-App-Gallery-badge.svg/1024px-Download-on-the-App-Gallery-badge.svg.png" 
          alt="Explore it on AppGallery" 
          fill
          sizes="176px"
          style={{objectFit: "contain"}}
        />
      </a>
    </div>
  );
};

export default AppStoreButtons;
