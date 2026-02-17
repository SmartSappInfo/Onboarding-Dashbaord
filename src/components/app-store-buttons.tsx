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
          src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/Logo_PlayStore%20(1).png?alt=media&token=9b67f0c9-3030-4de1-ba17-b07dc799846c" 
          alt="Get it on Google Play" 
          fill 
          sizes="176px"
          className="object-contain"
        />
      </a>
      <a href={storeLinks.ios} target="_blank" rel="noopener noreferrer" className="relative block h-14 w-44 transition-transform hover:scale-105">
        <Image 
          src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/Logo_AppleStore.png?alt=media&token=e7c54394-916b-482c-88ef-d3b051fe847c" 
          alt="Download on the App Store" 
          fill
          sizes="176px"
          className="object-contain"
        />
      </a>
      <a href={storeLinks.huawei} target="_blank" rel="noopener noreferrer" className="relative block h-14 w-44 transition-transform hover:scale-105">
        <Image 
          src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/Logo_HuaweiStore.png?alt=media&token=99bf0821-d46d-456c-a867-285c2f161eb0" 
          alt="Explore it on AppGallery" 
          fill
          sizes="176px"
          className="object-contain"
        />
      </a>
    </div>
  );
};

export default AppStoreButtons;
