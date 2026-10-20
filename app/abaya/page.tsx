"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import styles from './page.module.css';
import { db, auth } from "../../lib/firebase";
import { signInAnonymously } from 'firebase/auth';
import { 
  collection, 
  doc, 
  serverTimestamp, 
  getDoc, 
  runTransaction
} from 'firebase/firestore';

// Types
interface BundleOption {
  id: string;
  title: string;
  subtitle: string;
  quantity: number;
  price: number;
  oldPrice: number;
  discountPercentage: number;
  isPopular?: boolean;
  freeShipping: boolean;
  freeGift: string;
}

const BUNDLE_OPTIONS: BundleOption[] = [
  {
    id: 'single',
    title: 'عباية واحدة ملكية',
    subtitle: 'تشمل شيلة مطرزة فاخرة هدية + توصيل مجاني لكافة المحافظات',
    quantity: 1,
    price: 55000,
    oldPrice: 65000,
    discountPercentage: 15,
    freeShipping: true,
    freeGift: 'شيلة مطرزة فاخرة'
  },
  {
    id: 'double',
    title: 'عبايتين ملكية (الأكثر طلباً 🥇)',
    subtitle: 'وفري 15,000 د.ع إضافية + شحن مجاني + 2 شيلة هدية',
    quantity: 2,
    price: 95000,
    oldPrice: 130000,
    discountPercentage: 27,
    isPopular: true,
    freeShipping: true,
    freeGift: '2 شيلة مطرزة فاخرة'
  },
  {
    id: 'triple',
    title: 'عرض الـ 3 عبايات (باقة البركة 💎)',
    subtitle: 'وفري 39,000 د.ع إضافية + شحن مجاني + 3 شيل + عطر عبايات فاخر',
    quantity: 3,
    price: 126000,
    oldPrice: 195000,
    discountPercentage: 35,
    freeShipping: true,
    freeGift: '3 شيل + عطر عبايات فاخر'
  }
];

const SIZES = [
  { size: '50', height: '148 - 153 سم', bust: '21 إنش', sleeve: '26 إنش' },
  { size: '52', height: '154 - 158 سم', bust: '22 إنش', sleeve: '27 إنش' },
  { size: '54', height: '159 - 164 سم', bust: '23 إنش', sleeve: '28 إنش' },
  { size: '56', height: '165 - 169 سم', bust: '24 إنش', sleeve: '29 إنش' },
  { size: '58', height: '170 - 174 سم', bust: '25 إنش', sleeve: '30 إنش' },
  { size: '60', height: '175+ سم', bust: '26 إنش', sleeve: '30.5 إنش' }
];

const IRAQI_GOVERNORATES = [
  "بغداد", "البصرة", "أربيل", "النجف الأشرف", "كربلاء المقدسة", 
  "نينوى (الموصل)", "كركوك", "بابل (الحلة)", "ذي قار (الناصرية)", 
  "الأنبار (الرمادي)", "ديالى (بعقوبة)", "واسط (الكوت)", "ميسان (العمارة)", 
  "صلاح الدين (تكريت)", "القادسية (الديوانية)", "المثنى (السماوة)", 
  "دهوك", "السليمانية"
];

const REVIEWS = [
  {
    name: 'أم فاطمة الزهراء',
    city: 'بغداد - المنصور',
    date: 'قبل يومين',
    stars: 5,
    avatar: 'ف',
    comment: 'والله العظيم العباية تجنن، سوادها فاحم وموديلها راقي ومحتشم جداً. المندوب جان كلش محترم وانتظرني فتحت الطرد وتأكدت من القماش والقياس قبل ما ادفع. شكراً على المصداقية.'
  },
  {
    name: 'سارة المهندس',
    city: 'أربيل - عينكاوة',
    date: 'قبل 3 أيام',
    stars: 5,
    avatar: 'س',
    comment: 'خامة الكريب الكوري كلش باردة وانسيابية ما تحتاج كوي هواية والتطريز بالكم نظيف ومتقن ودرجة السواد ملكية حقيقية. عاشت ايديكم والشيلة الهدية كلش فخمة.'
  },
  {
    name: 'زينب الموسوي',
    city: 'النجف الأشرف',
    date: 'قبل 5 أيام',
    stars: 5,
    avatar: 'ز',
    comment: 'اخذت عرض العبايتين لي ولأختي وطلعت القياسات مضبوطة مية بالمية حسب الجدول. التوصيل سريع والمعاينة قبل الاستلام انطتني ثقة تامة. انصح الجميع بطلبها.'
  },
  {
    name: 'نور الهدى',
    city: 'البصرة - الجزائر',
    date: 'قبل أسبوع',
    stars: 5,
    avatar: 'ن',
    comment: 'تغليف راقي ينفع هدية فخمة، والقماش مو شفاف ابداً وبارد مناسب لجو البصرة. شكراً لحسن التعامل وسرعة الرد.'
  }
];

const LIVE_TOASTS = [
  { name: 'فاطمة الكعبي', city: 'بغداد', size: '54', time: 'قبل 3 دقائق' },
  { name: 'مروة الشمري', city: 'البصرة', size: '56', time: 'قبل 7 دقائق' },
  { name: 'هدى الخالدي', city: 'أربيل', size: '52', time: 'قبل 11 دقيقة' },
  { name: 'تبارك علي', city: 'النجف', size: '54', time: 'قبل 15 دقيقة' },
  { name: 'إسراء السعدي', city: 'كربلاء', size: '58', time: 'قبل 18 دقيقة' }
];

function AbayaLandingInner() {
  // Gallery with auto-rotation (1080x1080)
  const [images, setImages] = useState<Array<{ src: string; label: string }>>([
    { src: '/abaya/1.jpg', label: 'المظهر الكامل' },
    { src: '/abaya/2.jpg', label: 'تفاصيل القماش والتطريز' },
    { src: '/abaya/3.jpg', label: 'انسيابية القماش والحشمة' }
  ]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isAutoPlayPaused, setIsAutoPlayPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Check if additional images like 4.jpg, 5.jpg, 6.jpg exist in public/abaya
  useEffect(() => {
    const candidateUrls = [
      '/abaya/4.jpg',
      '/abaya/5.jpg',
      '/abaya/6.jpg',
      '/abaya/7.jpg',
      '/abaya/8.jpg'
    ];

    candidateUrls.forEach((url, i) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setImages((prev) => {
          if (prev.some((item) => item.src === url)) return prev;
          return [...prev, { src: url, label: `صورة ${i + 4}` }];
        });
      };
    });
  }, []);

  // Automatic image sliding (هوه يكلب بلصور تلقائي كل 3.5 ثانية)
  useEffect(() => {
    if (isAutoPlayPaused || images.length <= 1) return;

    const interval = setInterval(() => {
      setActiveImageIdx((prev) => (prev + 1) % images.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [isAutoPlayPaused, images.length]);

  const handleNextImage = () => {
    setActiveImageIdx((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsAutoPlayPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (diff > 40) {
        handleNextImage(); // swipe left
      } else if (diff < -40) {
        handlePrevImage(); // swipe right
      }
    }
    touchStartX.current = null;
    setIsAutoPlayPaused(false);
  };

  // Selection States
  const [selectedBundle, setSelectedBundle] = useState<BundleOption>(BUNDLE_OPTIONS[0]); // default to single abaya
  const [selectedSize, setSelectedSize] = useState<string>('54');

  // Form States
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [governorate, setGovernorate] = useState('بغداد');
  const [addressDetails, setAddressDetails] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Modals & UI
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Social Proof Toast
  const [activeToast, setActiveToast] = useState<any>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Live countdown timer (7 hours, 38 minutes, 42 seconds)
  const DEFAULT_OFFER_SECONDS = 7 * 3600 + 38 * 60 + 42;
  const [timeLeft, setTimeLeft] = useState(DEFAULT_OFFER_SECONDS);

  // Form Reference for scroll
  const formRef = useRef<HTMLDivElement>(null);

  // URL Params State
  const [targetUid, setTargetUid] = useState<string>('guAXkcygceeBkpwtFdf1n8O3dRX2');
  const [supportPhone, setSupportPhone] = useState<string>('9647700000000');
  const [snapPixelId, setSnapPixelId] = useState<string>('74262440-1baf-4c72-8fe1-2151b67081e4');

  // Helper to format phone for Snapchat (E.164 format with +964)
  const formatPhoneForSnapchat = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('00964')) {
      return '+964' + cleaned.substring(5);
    }
    if (cleaned.startsWith('+964')) {
      return cleaned;
    }
    if (cleaned.startsWith('964')) {
      return '+' + cleaned;
    }
    if (cleaned.startsWith('07')) {
      return '+964' + cleaned.substring(1);
    }
    if (cleaned.startsWith('7')) {
      return '+964' + cleaned;
    }
    return cleaned;
  };

  // Helper to extract or generate Snapchat UUID C1 (First-Party Cookie / Click ID)
  const getSnapchatUuidC1 = (): string => {
    if (typeof window === 'undefined') return '';
    try {
      const params = new URLSearchParams(window.location.search);
      const clickId = params.get('ScCid') || params.get('sc_click_id') || params.get('sccid');
      if (clickId) {
        try { localStorage.setItem('_snap_uuid_c1', clickId); } catch (_) {}
        return clickId;
      }

      const match = document.cookie.match(/(?:^|;\s*)_scid=([^;]+)/);
      if (match && match[1]) {
        return match[1];
      }

      let stored = '';
      try { stored = localStorage.getItem('_snap_uuid_c1') || ''; } catch (_) {}
      if (!stored) {
        stored = 'c1_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
        try { localStorage.setItem('_snap_uuid_c1', stored); } catch (_) {}
      }
      return stored;
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const uidParam = params.get('uid') || params.get('store') || 'guAXkcygceeBkpwtFdf1n8O3dRX2';
      const phoneParam = params.get('phone') || params.get('whatsapp') || '';
      const pixelParam = params.get('snap_pixel') || params.get('pixel') || '74262440-1baf-4c72-8fe1-2151b67081e4';

      setTargetUid(uidParam);
      if (phoneParam) setSupportPhone(phoneParam);
      setSnapPixelId(pixelParam);

      // Authenticate visitor anonymously for firestore order placement if not logged in
      if (!auth.currentUser) {
        signInAnonymously(auth).catch((err) => console.log('Public visitor auth:', err));
      }

      // Inject Snapchat Pixel base script
      if (!(window as any).snaptr) {
        (function(e: any, t: any, n: any) {
          if (e.snaptr) return;
          var a: any = (e.snaptr = function() {
            a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments);
          });
          a.queue = [];
          var s = 'script';
          var r = t.createElement(s);
          r.async = true;
          r.src = n;
          var u = t.getElementsByTagName(s)[0];
          if (u && u.parentNode) {
            u.parentNode.insertBefore(r, u);
          } else {
            t.head.appendChild(r);
          }
        })(window, document, 'https://sc-static.net/scevent.min.js');
      }

      // Initialize Snapchat Pixel with the active Pixel ID
      try {
        (window as any).snaptr('init', pixelParam);
      } catch (initErr) {
        console.error('Snap Pixel init error:', initErr);
      }

      // Trigger Snap Pixel PageView & ViewContent with UUID C1
      try {
        if ((window as any).snaptr) {
          const uuidC1 = getSnapchatUuidC1();
          (window as any).snaptr('track', 'PAGE_VIEW', {
            uuid_c1: uuidC1
          });
          (window as any).snaptr('track', 'VIEW_CONTENT', {
            price: selectedBundle.price,
            currency: 'IQD',
            item_ids: ['abaya_malakiya'],
            item_category: 'عبايات',
            uuid_c1: uuidC1
          });
        }
      } catch (err) {
        console.error('Snap Pixel track error:', err);
      }
    }
  }, []);

  // Countdown Interval (7 hours, 38 minutes) with persistence
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    const savedEnd = localStorage.getItem('abaya_offer_endtime_7h');
    let targetEnd = savedEnd ? parseInt(savedEnd, 10) : 0;

    if (!targetEnd || targetEnd <= now) {
      targetEnd = now + DEFAULT_OFFER_SECONDS;
      localStorage.setItem('abaya_offer_endtime_7h', targetEnd.toString());
    }

    const updateTimer = () => {
      const currentNow = Math.floor(Date.now() / 1000);
      const remaining = targetEnd - currentNow;
      if (remaining > 0) {
        setTimeLeft(remaining);
      } else {
        const newEnd = currentNow + DEFAULT_OFFER_SECONDS;
        localStorage.setItem('abaya_offer_endtime_7h', newEnd.toString());
        setTimeLeft(DEFAULT_OFFER_SECONDS);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time HH : MM : SS
  const formatTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')} : ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
  };

  // Rotating Social Proof Toasts
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setActiveToast(LIVE_TOASTS[index % LIVE_TOASTS.length]);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 4500);
      index++;
    }, 9500);

    return () => clearInterval(interval);
  }, []);

  // Calculate Shipping & Total (توصيل مجاني بالكامل)
  const shippingCost = 0;
  const grandTotal = selectedBundle.price;

  // Scroll to Form & Trigger ADD_CART
  const scrollToForm = () => {
    try {
      if ((window as any).snaptr) {
        const uuidC1 = getSnapchatUuidC1();
        (window as any).snaptr('track', 'ADD_CART', {
          price: selectedBundle.price,
          currency: 'IQD',
          item_ids: ['abaya_malakiya'],
          item_category: 'عبايات',
          number_items: selectedBundle.quantity,
          uuid_c1: uuidC1
        });
      }
    } catch (_) {}
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle Order Submit
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 10) {
      setErrorMessage('يرجى إدخال رقم هاتف عراقي صالح (10 أو 11 رقم).');
      return;
    }

    if (!addressDetails.trim()) {
      setErrorMessage('يرجى تحديد العنوان بالتفصيل (المنطقة أو أقرب نقطة دالة).');
      return;
    }

    setIsSubmitting(true);

    try {
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const snapCampaignName = urlParams?.get('campaign_name') || urlParams?.get('utm_campaign') || '';
      const snapAdName = urlParams?.get('ad_name') || urlParams?.get('utm_content') || '';
      const snapAdId = urlParams?.get('ad_id') || urlParams?.get('utm_term') || '';
      const snapCampaignId = urlParams?.get('campaign_id') || '';

      // Keep notes 100% clean for shipping labels / waybills:
      const cleanCustomerNotes = orderNotes.trim() ? `القياس: ${selectedSize} | ${orderNotes.trim()}` : `القياس: ${selectedSize}`;

      const generatedOrderId = `SNAP-${Math.floor(100000 + Math.random() * 900000)}`;

      const orderPayload = {
        orderId: generatedOrderId,
        customerName: customerName.trim() || 'زبونة سناب شات',
        customerPhone: customerPhone.trim(),
        secondaryPhone: secondaryPhone.trim() || null,
        governorate,
        addressDetails: addressDetails.trim(),
        notes: cleanCustomerNotes,
        productName: 'عباية "الأميرة" الإسلامية الملكية',
        bundleTitle: selectedBundle.title,
        quantity: selectedBundle.quantity,
        size: selectedSize,
        color: 'أسود ملكي فاخر',
        itemPrice: selectedBundle.price,
        shippingCost,
        totalAmount: grandTotal,
        freeGift: selectedBundle.freeGift,
        source: 'صفحة الهبوط (سناب شات)',
        adId: snapAdId,
        adName: snapAdName,
        campaignName: snapCampaignName,
        campaignId: snapCampaignId,
        status: 'pending',
        paymentMethod: 'الدفع عند الاستلام',
        createdAt: serverTimestamp()
      };

      let finalOrderId = '';

      // If store owner uid is present, write directly into their orders collection
      if (targetUid) {
        try {
          const counterRef = doc(db, 'users', targetUid, 'metadata', 'orderCounter');
          let orderNumber = 100001;
          await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (counterDoc.exists()) {
              orderNumber = (counterDoc.data().lastId || 100000) + 1;
              transaction.update(counterRef, { lastId: orderNumber });
            } else {
              transaction.set(counterRef, { lastId: orderNumber });
            }

            const strOrderId = String(orderNumber);
            const orderDocRef = doc(db, 'users', targetUid, 'orders', strOrderId);

            transaction.set(orderDocRef, {
              id: strOrderId,
              order_id: strOrderId,
              customerName: customerName.trim() || 'زبونة سناب شات',
              customer_name: customerName.trim() || 'زبونة سناب شات',
              customerPhone: customerPhone.trim(),
              customer_phone: customerPhone.trim(),
              customerPhone2: secondaryPhone.trim() || '',
              customer_phone2: secondaryPhone.trim() || '',
              governorate: governorate,
              region: addressDetails.trim(),
              addressDetails: addressDetails.trim(),
              notes: cleanCustomerNotes,
              totalAmount: grandTotal,
              total_amount: grandTotal,
              deliveryCost: shippingCost || 0,
              paymentMethod: 'كاش عند التوصيل',
              payment_method: 'كاش عند التوصيل',
              source: 'صفحة الهبوط (سناب شات)',
              employeeId: 'landing_page_webhook',
              employeeName: 'صفحة الهبوط',
              bookingEmployeeId: 'landing_page_webhook',
              bookingEmployeeName: 'صفحة هبوط العبايات',
              order_type: 'snapchat_abaya',
              orderType: 'snapchat_abaya',
              adId: snapAdId,
              adName: snapAdName,
              campaignName: snapCampaignName,
              campaignId: snapCampaignId,
              items: [
                {
                  id: 'abaya_malakiya',
                  productId: 'abaya_malakiya',
                  name: `عباية الأميرة الإسلامية (${selectedBundle.title}) - قياس ${selectedSize}`,
                  productName: `عباية الأميرة الإسلامية (${selectedBundle.title}) - قياس ${selectedSize}`,
                  quantity: selectedBundle.quantity,
                  unitPrice: Math.round(selectedBundle.price / selectedBundle.quantity),
                  price: Math.round(selectedBundle.price / selectedBundle.quantity),
                  total: grandTotal,
                  selectedUnit: 'قطعة'
                }
              ],
              date: serverTimestamp(),
              timestamp: Date.now(),
              status: 'pending',
              is_settled: false
            });
          });
          finalOrderId = String(orderNumber);
        } catch (dbErr) {
          console.warn("Could not save to user firestore subcollection, continuing to order display:", dbErr);
        }
      }

      const orderTrackingId = finalOrderId || generatedOrderId;

      // Track Snap Pixel Purchase Event with UUID C1 and Customer Phone
      try {
        if ((window as any).snaptr) {
          const uuidC1 = getSnapchatUuidC1();
          const formattedPhone = formatPhoneForSnapchat(customerPhone) || customerPhone.trim();
          (window as any).snaptr('track', 'PURCHASE', {
            price: grandTotal,
            currency: 'IQD',
            transaction_id: orderTrackingId,
            item_ids: ['abaya_malakiya'],
            item_category: 'عبايات',
            number_items: selectedBundle.quantity,
            uuid_c1: uuidC1,
            user_phone_number: formattedPhone
          });
        }
      } catch (pixErr) {
        console.error('Pixel error:', pixErr);
      }

      setConfirmedOrderId(orderTrackingId);
      setIsSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Order submission error:', err);
      setErrorMessage('حدث خطأ أثناء إرسال الطلب، يرجى إعادة المحاولة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Brand Header */}
        <header className={styles.brandHeader}>
          <div className={styles.brandLogoArea}>
            <span className={styles.brandCrown}>👑</span>
            <div className={styles.brandTitles}>
              <span className={styles.brandName}>دار الحشمة الملكية</span>
              <span className={styles.brandSub}>
                أرقى العبايات الإسلامية المحتشمة
                <span className={styles.verifiedBadge}>موثق 🛡️</span>
              </span>
            </div>
          </div>
          <div className={styles.snapChatPill}>
            <span>Snapchat</span>
            <span>👻</span>
          </div>
        </header>

        {/* Live Viewing Header */}
        <div className={styles.liveViewingBar}>
          <div className={styles.liveIndicator}>
            <span className={styles.pulseDot}></span>
            <span>تشاهد هذا العرض الآن 29 سيدة</span>
          </div>
          <div>العراق 🇮🇶 كريب كوري أصلي</div>
        </div>

        {/* Hero Visual Showcase - Square 1080x1080 Auto-Rotating Slider */}
        <section 
          className={styles.heroVisualSection}
          onMouseEnter={() => setIsAutoPlayPaused(true)}
          onMouseLeave={() => setIsAutoPlayPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.mainImageContainer}>
            <img 
              key={activeImageIdx}
              src={images[activeImageIdx]?.src || '/abaya/1.jpg'} 
              alt="عباية إسلامية ملكية فاخرة" 
              className={styles.mainHeroImage}
            />

            {/* Offer Badges */}
            <div className={styles.floatingOfferTag}>
              <span>وفر حتى 69,000 د.ع 🔥</span>
            </div>
            <div className={styles.floatingFabricTag}>
              <span>سواد كربوني فاحم ✨</span>
            </div>

            {/* Previous and Next Navigation Buttons */}
            {images.length > 1 && (
              <>
                <button 
                  type="button" 
                  className={`${styles.sliderNavBtn} ${styles.sliderPrevBtn}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevImage();
                  }}
                  title="الصورة السابقة"
                >
                  ›
                </button>
                <button 
                  type="button" 
                  className={`${styles.sliderNavBtn} ${styles.sliderNextBtn}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextImage();
                  }}
                  title="الصورة التالية"
                >
                  ‹
                </button>
              </>
            )}

            {/* Dots Indicator */}
            {images.length > 1 && (
              <div className={styles.sliderDotsBar}>
                {images.map((_, idx) => (
                  <span 
                    key={idx} 
                    className={`${styles.sliderDot} ${activeImageIdx === idx ? styles.activeDot : ''}`}
                    onClick={() => setActiveImageIdx(idx)}
                  />
                ))}
              </div>
            )}

            {/* Image Counter Badge */}
            {images.length > 1 && (
              <div className={styles.sliderCounter}>
                {activeImageIdx + 1} / {images.length}
              </div>
            )}

            <div className={styles.imageGradientOverlay}></div>
          </div>

          {/* Thumbnails Bar */}
          <div className={styles.thumbnailBar}>
            {images.map((img, idx) => (
              <div 
                key={idx} 
                className={`${styles.thumbnailItem} ${activeImageIdx === idx ? styles.activeThumbnail : ''}`}
                onClick={() => setActiveImageIdx(idx)}
              >
                <img src={img.src} alt={img.label} className={styles.thumbnailImg} />
              </div>
            ))}
          </div>
        </section>

        {/* Product Details Card */}
        <div className={styles.productDetailsCard}>
          {/* Rating */}
          <div className={styles.productRatingRow}>
            <span className={styles.starGroup}>⭐⭐⭐⭐⭐</span>
            <span className={styles.reviewCountText}>(4.9 من 5) | أكثر من 380+ تقييم موثق</span>
          </div>

          {/* Title */}
          <h1 className={styles.productMainTitle}>
            عباية <span className={styles.highlightText}>"الأميرة"</span> الإسلامية الملكية
          </h1>

          <p className={styles.productShortDescription}>
            مصممة بأعلى معايير الحشمة والأناقة من قماش <strong>الكريب الكوري الملكي الفاخر</strong>، سواد فاحم لا يبهت، قماش انسيابي بارد وناعم غير شفاف إطلاقاً، مع تطريز راقٍ على الأكمام وشيلة مطابقة مجاناً.
          </p>

          {/* Price Box */}
          <div className={styles.priceHighlightBox}>
            <div className={styles.priceRow}>
              <div className={styles.mainPriceContainer}>
                <span className={styles.currentPrice}>
                  {selectedBundle.price.toLocaleString()}
                  <span className={styles.currencyUnit}> د.ع</span>
                </span>
                <span className={styles.oldPrice}>
                  {selectedBundle.oldPrice.toLocaleString()} د.ع
                </span>
              </div>
              <span className={styles.discountPill}>
                وفري {selectedBundle.discountPercentage}%
              </span>
            </div>
            <div className={styles.saveAmountNote}>
              <span>✓ توفير حقيقي: {(selectedBundle.oldPrice - selectedBundle.price).toLocaleString()} د.ع</span>
              <span>• الدفع عند الاستلام بعد المعاينة</span>
            </div>
          </div>

          {/* Urgency Countdown Bar */}
          <div className={styles.urgencyBox}>
            <div className={styles.urgencyHeader}>
              <span className={styles.countdownLabel}>
                <span>⏳</span> ينتهي هذا الخصم بعد:
              </span>
              <span className={styles.timerDigits}>{formatTime(timeLeft)}</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div className={styles.progressBarFill} style={{ width: '85%' }}></div>
            </div>
            <div className={styles.stockStatusText}>
              ⚠️ متبقي في المخزن 6 قطع فقط بهذا السعر المخفض!
            </div>
          </div>

          {/* Package / Bundle Selector */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <h3 className={styles.sectionTitle}>
                <span>📦</span> اختاري باقة العرض المفضلة:
              </h3>
            </div>
            <div className={styles.bundleCardsGrid}>
              {BUNDLE_OPTIONS.map((b) => {
                const isActive = selectedBundle.id === b.id;
                return (
                  <div 
                    key={b.id} 
                    className={`${styles.bundleCard} ${isActive ? styles.activeBundle : ''}`}
                    onClick={() => {
                      setSelectedBundle(b);
                      try {
                        if ((window as any).snaptr) {
                          const uuidC1 = getSnapchatUuidC1();
                          (window as any).snaptr('track', 'ADD_CART', {
                            price: b.price,
                            currency: 'IQD',
                            item_ids: ['abaya_malakiya'],
                            item_category: 'عبايات',
                            number_items: b.quantity,
                            uuid_c1: uuidC1
                          });
                        }
                      } catch (_) {}
                    }}
                  >
                    {b.isPopular && (
                      <span className={styles.bundleRibbon}>الأكثر مبيعاً 🌟</span>
                    )}
                    <div className={styles.bundleCheckCol}>
                      <div className={styles.customRadio}>
                        {isActive && <div className={styles.customRadioInner}></div>}
                      </div>
                      <div className={styles.bundleInfoCol}>
                        <h4>{b.title}</h4>
                        <span className={styles.bundleSubtitle}>{b.subtitle}</span>
                      </div>
                    </div>
                    <div className={styles.bundlePriceCol}>
                      <div className={styles.bundlePrice}>{b.price.toLocaleString()} د.ع</div>
                      <div className={styles.bundleOldPrice}>{b.oldPrice.toLocaleString()} د.ع</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Size Selector */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <h3 className={styles.sectionTitle}>
                <span>📏</span> اختاري المقاس المناسب:
              </h3>
              <span className={styles.sizeGuideLink} onClick={() => setIsSizeModalOpen(true)}>
                دليل المقاسات التفصيلي 📐
              </span>
            </div>
            <div className={styles.sizePillsGrid}>
              {SIZES.map((s) => {
                const isActive = selectedSize === s.size;
                return (
                  <div 
                    key={s.size} 
                    className={`${styles.sizePill} ${isActive ? styles.activeSize : ''}`}
                    onClick={() => setSelectedSize(s.size)}
                  >
                    <span className={styles.sizeNumber}>{s.size}</span>
                    <span className={styles.sizeHeightHint}>{s.height}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Checkout Form */}
          <div className={styles.orderFormContainer} ref={formRef} id="order-form">
            <div className={styles.formHeader}>
              <span className={styles.formHeaderBadge}>طلب سريع وسهل</span>
              <h2 className={styles.formMainTitle}>أدخلي بياناتكِ للتوصيل</h2>
              <p className={styles.formSubtitle}>الدفع عند الاستلام بعد معاينة وفحص القطعة</p>
            </div>

            {errorMessage && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                marginBottom: '14px',
                fontWeight: 600
              }}>
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleOrderSubmit} className={styles.formInputsList}>
              {/* Customer Phone */}
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  رقم الهاتف (الأساسي) <span className={styles.requiredStar}>*</span>
                </label>
                <input 
                  type="tel" 
                  placeholder="مثال: 0770xxxxxxx"
                  className={styles.styledInput}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>

              {/* Governorate */}
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  المحافظة <span className={styles.requiredStar}>*</span>
                </label>
                <select 
                  className={styles.styledSelect}
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                >
                  {IRAQI_GOVERNORATES.map(gov => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
              </div>

              {/* Detailed Address */}
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  المنطقة والعنوان بالتفصيل <span className={styles.requiredStar}>*</span>
                </label>
                <textarea 
                  placeholder="المنطقة، الشارع، أقرب نقطة دالة، رقم الفرع..."
                  className={styles.styledTextarea}
                  value={addressDetails}
                  onChange={(e) => setAddressDetails(e.target.value)}
                  required
                />
              </div>

              {/* Notes */}
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  ملاحظات إضافية للتوصيل (اختياري)
                </label>
                <input 
                  type="text" 
                  placeholder="مثال: التوصيل مساءً / الاتصال قبل الوصول"
                  className={styles.styledInput}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>

              {/* Order Bill Summary */}
              <div className={styles.orderBillSummary}>
                <div className={styles.summaryRow}>
                  <span>المنتج:</span>
                  <span>عباية الأميرة الإسلامية (مقاس {selectedSize})</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>الباقة المختارة:</span>
                  <span>{selectedBundle.title}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>الهدية المرفقة:</span>
                  <span style={{ color: '#34d399', fontWeight: 'bold' }}>{selectedBundle.freeGift} (مجاناً) 🎁</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>تكلفة الشحن لـ ({governorate}):</span>
                  <span className={styles.freeShipBadge}>مجاني 🚚</span>
                </div>
                <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                  <span>المبلغ الإجمالي عند الاستلام:</span>
                  <span>{grandTotal.toLocaleString()} د.ع</span>
                </div>
              </div>

              {/* Submit CTA Button */}
              <button 
                type="submit" 
                className={styles.submitOrderBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>جاري تأكيد حجزكِ... ⏳</span>
                ) : (
                  <>
                    <span>تأكيد الطلب الآن (الدفع عند الاستلام) 🛍️</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Features Highlights */}
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>❄️</div>
              <div className={styles.featureTitle}>كريب كوري بارد</div>
              <div className={styles.featureDesc}>انسيابي ومريح جداً، غير شفاف نهائياً ولا يمسك وبر أو غبار.</div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🖤</div>
              <div className={styles.featureTitle}>سواد فاحم دائم</div>
              <div className={styles.featureDesc}>معالجة ملكية خاصة تضمن بقاء السواد داكناً حتى مع الغسيل المتكرر.</div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🧕</div>
              <div className={styles.featureTitle}>شيلة هدية مجانية</div>
              <div className={styles.featureDesc}>تصلكِ مع العباية شيلة مطرزة بنفس فخامة العباية مجاناً.</div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔄</div>
              <div className={styles.featureTitle}>استبدال المقاس مجاناً</div>
              <div className={styles.featureDesc}>إذا كان القياس غير مناسب، نستبدله لكِ فوراً بدون أي صعوبة.</div>
            </div>
          </div>

          {/* Guarantees Ribbon */}
          <div className={styles.guaranteesBanner}>
            <div className={styles.guaranteeShieldIcon}>🛡️</div>
            <div>
              <div className={styles.guaranteeTitle}>حق الفحص والمعاينة قبل الدفع!</div>
              <div className={styles.guaranteeDesc}>
                افتحي الطرد أمام مندوب التوصيل وتأكدي من نعومة القماش وجودة الخياطة والمقاس بنفسكِ قبل دفع أي دينار.
              </div>
            </div>
          </div>

          {/* Customer Reviews Section */}
          <div className={styles.reviewsSection}>
            <div className={styles.reviewsHeader}>
              <div className={styles.reviewScoreBadge}>
                <span>⭐ تقييمات الزبونات</span>
              </div>
              <h3 className={styles.sectionTitle} style={{ justifyContent: 'center' }}>
                تجارب حقيقية لزبوناتنا في العراق
              </h3>
            </div>
            <div className={styles.reviewsList}>
              {REVIEWS.map((rev, index) => (
                <div key={index} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <div className={styles.reviewerMeta}>
                      <div className={styles.reviewerAvatar}>{rev.avatar}</div>
                      <div>
                        <div className={styles.reviewerName}>{rev.name}</div>
                        <div className={styles.reviewerCity}>{rev.city} • {rev.date}</div>
                      </div>
                    </div>
                    <span className={styles.verifiedPurchaseChip}>مشترية موثقة ✓</span>
                  </div>
                  <div style={{ color: '#fbbf24', fontSize: '0.85rem', marginBottom: '6px' }}>
                    {'★'.repeat(rev.stars)}
                  </div>
                  <p className={styles.reviewText}>{rev.comment}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Accordion */}
          <div className={styles.faqSection}>
            <h3 className={styles.sectionTitle} style={{ marginBottom: '14px' }}>
              <span>❓</span> الأسئلة الأكثر شيوعاً:
            </h3>

            <div className={styles.faqItem}>
              <div 
                className={styles.faqQuestion}
                onClick={() => setOpenFaq(openFaq === 0 ? null : 0)}
              >
                <span>هل يحق لي فتح الطرد والمعاينة قبل دفع المبلغ للمندوب؟</span>
                <span>{openFaq === 0 ? '▲' : '▼'}</span>
              </div>
              {openFaq === 0 && (
                <div className={styles.faqAnswer}>
                  نعم بكل تأكيد! نحن نعتمد سياسة المعاينة قبل الاستلام. المندوب سينتظر حضرتك لتفتحي الشحنة وتتأكدي من سواد القماش وجودة الخياطة والتطريز، وإذا لم تعجبك يمكنك رفض الاستلام دون أي تكاليف.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <div 
                className={styles.faqQuestion}
                onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
              >
                <span>هل القماش شفاف أو يحتاج كوي مستمر؟</span>
                <span>{openFaq === 1 ? '▲' : '▼'}</span>
              </div>
              {openFaq === 1 && (
                <div className={styles.faqAnswer}>
                  قماش الكريب الكوري الملكي غير شفاف نهائياً (تعتيم كامل 100%)، بارد وانسيابي على الجسم، ومقاوم للتجعد والتكسر بحيث لا يحتاج كوي متكرر بعد الغسيل.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <div 
                className={styles.faqQuestion}
                onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
              >
                <span>ماذا لو كان المقاس غير مناسب بعد الاستلام؟</span>
                <span>{openFaq === 2 ? '▲' : '▼'}</span>
              </div>
              {openFaq === 2 && (
                <div className={styles.faqAnswer}>
                  نوفر لكِ خدمة استبدال المقاس الفوري مجاناً خلال 7 أيام من الاستلام، يكفي فقط التواصل مع فريق خدمة العملاء وسنقوم بإرسال المقاس الجديد إليكِ فوراً.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <div 
                className={styles.faqQuestion}
                onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}
              >
                <span>كم يوم يستغرق التوصيل؟</span>
                <span>{openFaq === 3 ? '▲' : '▼'}</span>
              </div>
              {openFaq === 3 && (
                <div className={styles.faqAnswer}>
                  التوصيل داخل بغداد يتم خلال 24 ساعة فقط، ولباقي المحافظات خلال 24 إلى 48 ساعة كحد أقصى لباب منزلكِ.
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className={styles.landingFooter}>
            <p>جميع الحقوق محفوظة © {new Date().getFullYear()} دار الحشمة الملكية</p>
            <p style={{ marginTop: '4px' }}>أفخم العبايات الإسلامية المحتشمة - شحن سريع لكافة محافظات العراق 🇮🇶</p>
          </footer>
        </div>

        {/* Sticky Floating Bottom Bar for Mobile / Snapchat */}
        <div className={styles.stickyBottomBar}>
          <div className={styles.stickyBarInner}>
            <div className={styles.stickyPriceArea}>
              <span className={styles.stickyCurrentPrice}>
                {selectedBundle.price.toLocaleString()} د.ع
              </span>
              <span className={styles.stickyOldPrice}>
                {selectedBundle.oldPrice.toLocaleString()} د.ع
              </span>
            </div>
            <button className={styles.stickyCTAButton} onClick={scrollToForm}>
              <span>اطلبي الآن (الدفع عند الاستلام) 🛍️</span>
            </button>
          </div>
        </div>

        {/* Live Social Proof Toast */}
        {toastVisible && activeToast && (
          <div className={styles.socialProofToast}>
            <img src="/abaya/detail.jpg" alt="عباية" className={styles.toastThumb} />
            <div className={styles.toastText}>
              <span className={styles.toastName}>{activeToast.name} من {activeToast.city}</span>
              <span className={styles.toastAction}>طلبت عباية مقاس {activeToast.size}</span>
              <span className={styles.toastTime}>{activeToast.time}</span>
            </div>
          </div>
        )}

        {/* Size Guide Modal */}
        {isSizeModalOpen && (
          <div className={styles.modalBackdrop} onClick={() => setIsSizeModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalCloseBtn} onClick={() => setIsSizeModalOpen(false)}>✕</button>
              <h3 className={styles.sectionTitle} style={{ fontSize: '1.15rem' }}>
                📐 جدول مقاسات العباية التفصيلي
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                اختاري المقاس حسب طول قامتكِ من الكتف إلى القدم:
              </p>
              <table className={styles.sizeTable}>
                <thead>
                  <tr>
                    <th>المقاس</th>
                    <th>طول القامة</th>
                    <th>محيط الصدر</th>
                    <th>طول الكم</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZES.map(s => (
                    <tr key={s.size} style={{ background: selectedSize === s.size ? 'rgba(251, 191, 36, 0.1)' : undefined }}>
                      <td style={{ fontWeight: 'bold', color: selectedSize === s.size ? '#fbbf24' : '#fff' }}>
                        {s.size} {selectedSize === s.size ? '✓' : ''}
                      </td>
                      <td>{s.height}</td>
                      <td>{s.bust}</td>
                      <td>{s.sleeve}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: '10px', fontSize: '0.78rem', color: '#e2e8f0' }}>
                💡 <strong>نصيحة:</strong> إذا كنتِ تفضلين لبس الكعب العالي أو قصة واسعة فضفاضة جداً، يمكنكِ اختيار مقاس أكبر بدرجة واحدة.
              </div>
            </div>
          </div>
        )}

        {/* Success Confirmation Modal */}
        {isSuccessModalOpen && (
          <div className={styles.modalBackdrop}>
            <div className={`${styles.modalContent} ${styles.successModal}`}>
              <div className={styles.successCheckIcon}>✓</div>
              <h2 className={styles.successTitle}>تهانينا، تم تأكيد طلبكِ بنجاح!</h2>
              <div className={styles.orderIdPill}>رقم الطلب: {confirmedOrderId}</div>
              <p className={styles.successSubtitle}>
                شكراً لثقتكِ بدار الحشمة الملكية 🌸<br />
                سيتصل بكِ فريق التوصيل لتأكيد موعد استلام الشحنة خلال وقت قصير.<br />
                <strong>تذكري: يحق لكِ فحص العباية والتأكد من القماش والقياس قبل الدفع للمندوب!</strong>
              </p>
              
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '14px',
                fontSize: '0.85rem',
                color: '#fef08a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                lineHeight: '1.5'
              }}>
                <span>📞</span>
                <span>سيتصل بكِ مندوبنا هاتفياً قريباً لتأكيد موعد التسليم المناسب لكِ.</span>
              </div>

              <button 
                className={styles.styledInput} 
                style={{ cursor: 'pointer', background: 'transparent', textAlign: 'center', fontWeight: 'bold' }}
                onClick={() => setIsSuccessModalOpen(false)}
              >
                العودة للصفحة الرئيسية
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function AbayaLandingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0d12', color: '#fbbf24' }}>
        <h3>جاري تحميل العرض الملكي... 👑</h3>
      </div>
    }>
      <AbayaLandingInner />
    </Suspense>
  );
}
