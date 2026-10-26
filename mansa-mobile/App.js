import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Switch, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Modal, 
  FlatList, 
  ActivityIndicator, 
  SafeAreaView, 
  Platform,
  StatusBar,
  Animated,
  Easing,
  AppState,
  Keyboard,
  Vibration
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Updates from 'expo-updates';
import { useVideoPlayer, VideoView } from 'expo-video';

// Safe dynamic require for expo-notifications to prevent Expo Go crashes
let Notifications = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      }
} catch (e) {
  console.log('expo-notifications safe initialization notice:', e?.message);
}
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import Svg, { Path, Circle, G, Polygon, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { db, auth } from './firebase';
import { 
  collection, 
  addDoc,
  onSnapshot, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDoc, 
  updateDoc,
  query as fsQuery, 
  where, 
  getDocs,
  limit,
  runTransaction,
  Timestamp,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  orderBy,
  startAfter
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';

// Fullscreen Intro / Splash Video Screen
function IntroVideoScreen({ onFinish }) {
  // Safety timeout: automatically advance after 7.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 7500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  let player = null;
  try {
    player = useVideoPlayer(require('./assets/intro.mp4'), p => {
      p.loop = false;
      p.play();
    });
  } catch (e) {
    console.log('Video player initialization notice:', e?.message);
  }

  useEffect(() => {
    if (!player) return;
    try {
      const sub = player.addListener('playToEnd', () => {
        onFinish();
      });
      return () => sub?.remove?.();
    } catch (e) {}
  }, [player, onFinish]);

  if (!player) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar hidden={true} />
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        nativeControls={false}
        contentFit="cover"
      />
    </View>
  );
}

export default function App() {
  const translateStatus = (status) => {
    switch (status) {
      case 'new': return 'جديد';
      case 'pending': return 'قيد الانتظار';
      case 'pending_warehouse': return 'قيد انتظار المخزن';
      case 'backordered': return 'قيد الانتظار (مخزن)';
      case 'processing': return 'قيد المعالجة';
      case 'processed': return 'تمت المعالجة';
      case 'confirmed': return 'مؤكد';
      case 'shipped': return 'تم الشحن';
      case 'ofd': return 'قيد التوصيل';
      case 'delivered': return 'مكتمل (لم تتم المحاسبة)';
      case 'delivered_settled': return 'مكتمل (تمت المحاسبة)';
      case 'partial': return 'واصل جزئي (لم تتم المحاسبة)';
      case 'returned': return 'راجع';
      case 'returned_agent': return 'راجع عند المندوب';
      case 'returned_warehouse': return 'راجع مخزن';
      case 'postponed': return 'مؤجل';
      case 'cancelled': return 'ملغي';
      case 'replaced': return 'استبدال';
      default: return status || 'غير معروف';
    }
  };

  const [isIntroFinished, setIsIntroFinished] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('appTheme').then(saved => {
      if (saved !== null) {
        setIsLightMode(saved === 'light');
      }
    }).catch(() => {});
  }, []);

  const toggleTheme = (val) => {
    setIsLightMode(val);
    AsyncStorage.setItem('appTheme', val ? 'light' : 'dark').catch(() => {});
  };
  const formatDateLocal = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const styles = useMemo(() => getStyles(isLightMode), [isLightMode]);



  // Check for OTA Updates on startup
  useEffect(() => {
    async function checkUpdates() {
      if (__DEV__) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log("Error checking for updates:", e);
      }
    }
    checkUpdates();
  }, []);

  const [activeTab, setActiveTab] = useState('orders');
  const [productsTab, setProductsTab] = useState('products');
  const [completedSearchQuery, setCompletedSearchQuery] = useState('');
  const [completedSubTab, setCompletedSubTab] = useState('accounted');
  const [returnedSubTab, setReturnedSubTab] = useState('agent');
  const [postponedSearchQuery, setPostponedSearchQuery] = useState('');
  const [returnedSearchQuery, setReturnedSearchQuery] = useState('');
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [todaySearchQuery, setTodaySearchQuery] = useState('');
  const [partialSearchQuery, setPartialSearchQuery] = useState('');
  const [processedSearchQuery, setProcessedSearchQuery] = useState('');
  const [ofdSearchQuery, setOfdSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Authentication State
  const [user, setUser] = useState(null);
  const [adminUid, setAdminUid] = useState(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [loggedInEmployeeId, setLoggedInEmployeeId] = useState('');
  const [loggedInSystemUserName, setLoggedInSystemUserName] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userPermissions, setUserPermissions] = useState({});
  const [statusChangeModal, setStatusChangeModal] = useState({ visible: false, order: null });
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [orderDetailsLogs, setOrderDetailsLogs] = useState([]);
  const [isLoadingOrderLogs, setIsLoadingOrderLogs] = useState(false);

  // Notifications State & Logic
  const [notificationsList, setNotificationsList] = useState([]);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);
  const [notifFilterTab, setNotifFilterTab] = useState('all'); // 'all' | 'orders' | 'status'
  const isInitialNotifsLoaded = useRef(false);
  const prevOrdersMapRef = useRef(new Map());
  const isInitialOrdersLoadedRef = useRef(false);
  const lastLocalActionOrderId = useRef(null);

  // In-App Notification Banner State ("البردة التفاعلية العلوية داخل التطبيق")
  const [inAppNotification, setInAppNotification] = useState(null);
  const inAppNotifAnim = useRef(new Animated.Value(-120)).current;

  const showInAppNotificationBanner = (notif) => {
    setInAppNotification(notif);
    try {
      Vibration.vibrate(250);
    } catch (e) {}
    Animated.sequence([
      Animated.timing(inAppNotifAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.delay(5000),
      Animated.timing(inAppNotifAnim, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInAppNotification(null);
    });
  };

  // Setup Notification Channel on Android (Safely guarded)
  useEffect(() => {
    async function configureNotifications() {
      try {
        if (Notifications && typeof Notifications.setNotificationChannelAsync === 'function' && Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'إشعارات الطلبات',
            importance: Notifications.AndroidImportance?.MAX || 4,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8b5cf6',
            sound: 'default',
          });
        }
        if (Notifications && typeof Notifications.getPermissionsAsync === 'function') {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
            await Notifications.requestPermissionsAsync();
          }
        }
      } catch (e) {
        console.log('Safe notice: Notifications permissions / channel config:', e?.message);
      }
    }
    configureNotifications();
  }, []);

  // Trigger Notification: shows in-app banner ("البردة") and triggers OS notification if available
  const triggerDeviceNotification = async ({ title, body, data }) => {
    // 1. In-App Banner ("البردة التفاعلية")
    showInAppNotificationBanner({ title, body, data });

    // 2. OS Notification shade if supported
    try {
      if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: title || 'إشعار من منصة منسا',
            body: body || '',
            data: data || {},
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority?.HIGH,
          },
          trigger: null,
        });
      }
    } catch (err) {
      console.log('Safe notice: scheduleNotificationAsync:', err?.message);
    }
  };

  // Open Order Details from notification click
  const openOrderDetailsById = async (orderId, fallbackReceiptNumber = null) => {
    if (!orderId && !fallbackReceiptNumber) return;
    const found = orders.find(o => 
      String(o.id) === String(orderId) || 
      (fallbackReceiptNumber && String(o.receiptNumber) === String(fallbackReceiptNumber))
    );
    if (found) {
      setSelectedOrderForDetails(found);
      return;
    }
    try {
      if (!adminUid) return;
      const snap = await getDoc(doc(db, 'users', adminUid, 'orders', String(orderId)));
      if (snap.exists()) {
        setSelectedOrderForDetails({ id: snap.id, ...snap.data() });
      } else {
        setAlertModal({ visible: true, message: 'تعذر العثور على بيانات هذا الطلب (قد يكون محذوفاً).' });
      }
    } catch (e) {
      console.log('Error opening order details:', e);
    }
  };

  // Handle clicking notification in system shade ("البردة")
  useEffect(() => {
    try {
      if (Notifications && typeof Notifications.addNotificationResponseReceivedListener === 'function') {
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response?.notification?.request?.content?.data;
          if (data?.orderId || data?.receiptNumber) {
            openOrderDetailsById(data.orderId, data.receiptNumber);
          }
        });
        return () => subscription?.remove?.();
      }
    } catch (e) {
      console.log('Safe notice: addNotificationResponseReceivedListener:', e?.message);
    }
  }, [orders, adminUid]);

  // Send Notification to Firestore: readBy and clearedBy start empty so every active user receives it independently
  const sendAppNotification = async ({
    title,
    body,
    type,
    orderId,
    receiptNumber,
    customerName,
    actorName,
    actorId,
    oldStatus,
    newStatus
  }) => {
    try {
      if (!adminUid) return;
      const notifsRef = collection(db, 'users', adminUid, 'notifications');
      const currentUid = user?.uid || 'unknown';
      const currentActor = actorName || getCurrentActorName();
      await addDoc(notifsRef, {
        title: title || 'إشعار جديد',
        body: body || '',
        type: type || 'order_created',
        orderId: String(orderId || ''),
        receiptNumber: String(receiptNumber || ''),
        customerName: customerName || '',
        actorName: currentActor,
        actorId: actorId || currentUid,
        oldStatus: oldStatus || null,
        newStatus: newStatus || null,
        createdAt: serverTimestamp(),
        readBy: [],      // Empty: every user must mark it read independently!
        clearedBy: []    // Empty: every user must clear it independently!
      });
    } catch (e) {
      console.log('Error writing notification to Firestore:', e);
    }
  };

  // Real-time listener for notifications collection
  useEffect(() => {
    if (!adminUid || !user) {
      setNotificationsList([]);
      return;
    }

    const notifsQuery = fsQuery(
      collection(db, 'users', adminUid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(60)
    );

    const unsub = onSnapshot(notifsQuery, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setNotificationsList(list);

      if (!isInitialNotifsLoaded.current) {
        isInitialNotifsLoaded.current = true;
        return;
      }

      // Check for incoming notifications from other users
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notifData = change.doc.data();
          const currentUserId = user?.uid;
          if (notifData.actorId !== currentUserId) {
            triggerDeviceNotification({
              title: notifData.title,
              body: notifData.body,
              data: { 
                orderId: notifData.orderId, 
                receiptNumber: notifData.receiptNumber 
              }
            });
          }
        }
      });
    }, (err) => {
      console.log('Error listening to notifications:', err);
    });

    return () => unsub();
  }, [adminUid, user]);

  // Notifications visible to the current user (excluding those cleared specifically by this user)
  const userVisibleNotifications = useMemo(() => {
    if (!user?.uid || !notificationsList) return [];
    return notificationsList.filter(n => {
      const cleared = Array.isArray(n.clearedBy) ? n.clearedBy : [];
      return !cleared.includes(user.uid);
    });
  }, [notificationsList, user]);

  // Unread count strictly for the current user
  const unreadNotificationsCount = useMemo(() => {
    if (!user?.uid || !userVisibleNotifications) return 0;
    return userVisibleNotifications.filter(n => {
      const read = Array.isArray(n.readBy) ? n.readBy : [];
      return !read.includes(user.uid);
    }).length;
  }, [userVisibleNotifications, user]);

  // Mark all as read strictly for current user
  const markAllNotificationsAsRead = async () => {
    if (!user?.uid || !adminUid || userVisibleNotifications.length === 0) return;
    try {
      const unread = userVisibleNotifications.filter(n => {
        const read = Array.isArray(n.readBy) ? n.readBy : [];
        return !read.includes(user.uid);
      });
      if (unread.length === 0) return;
      const batch = writeBatch(db);
      unread.slice(0, 50).forEach(n => {
        const nRef = doc(db, 'users', adminUid, 'notifications', n.id);
        batch.update(nRef, {
          readBy: arrayUnion(user.uid)
        });
      });
      await batch.commit();
    } catch (err) {
      console.log('Error marking all notifications as read:', err);
    }
  };

  // Clear/Dismiss notifications for current user (hides them only for this user; remains for other users!)
  const clearNotificationsForCurrentUser = async () => {
    if (!user?.uid || !adminUid || userVisibleNotifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      userVisibleNotifications.slice(0, 50).forEach(n => {
        const nRef = doc(db, 'users', adminUid, 'notifications', n.id);
        batch.update(nRef, {
          clearedBy: arrayUnion(user.uid),
          readBy: arrayUnion(user.uid)
        });
      });
      await batch.commit();
    } catch (err) {
      console.log('Error clearing notifications for user:', err);
    }
  };

  // Mark single as read strictly for current user
  const markNotificationAsRead = async (notifId) => {
    if (!user?.uid || !adminUid || !notifId) return;
    try {
      const nRef = doc(db, 'users', adminUid, 'notifications', notifId);
      await updateDoc(nRef, {
        readBy: arrayUnion(user.uid)
      });
    } catch (err) {
      console.log('Error marking notification as read:', err);
    }
  };

  // Open notification item
  const handleOpenNotificationItem = async (item) => {
    markNotificationAsRead(item.id);
    setIsNotificationsModalVisible(false);
    if (item.orderId || item.receiptNumber) {
      await openOrderDetailsById(item.orderId, item.receiptNumber);
    }
  };

  // Format notification time
  const formatNotifTime = (timestamp) => {
    if (!timestamp) return '';
    let d = null;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      d = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      d = timestamp;
    } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
      d = new Date(timestamp);
    }
    if (!d || isNaN(d.getTime())) return '';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'الآن';
    if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} دقيقة`;
    if (diffSec < 86400) return `منذ ${Math.floor(diffSec / 3600)} ساعة`;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    let h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'م' : 'ص';
    h = h % 12 || 12;
    return `${y}/${m}/${day} ${h}:${min} ${ampm}`;
  };

  useEffect(() => {
    if (!selectedOrderForDetails || !adminUid) {
      setOrderDetailsLogs([]);
      return;
    }
    setIsLoadingOrderLogs(true);
    const logsRef = collection(db, 'users', adminUid, 'orders', selectedOrderForDetails.id.toString(), 'logs');
    const q = fsQuery(logsRef, orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const hasCreation = logs.some(l => l.action && (l.action.includes('إنشاء') || l.action.includes('تثبيت')));
      if (!hasCreation) {
        const creator = selectedOrderForDetails.customerName || selectedOrderForDetails.systemUser || selectedOrderForDetails.bookingEmployeeName || 'موظف';
        logs.push({
          id: 'syn-create',
          action: 'إنشاء الطلب',
          details: `تم إنشاء وتثبيت الطلب من تطبيق الهاتف برقم #${selectedOrderForDetails.receiptNumber || selectedOrderForDetails.id}`,
          employeeName: creator,
          timestamp: selectedOrderForDetails.date || selectedOrderForDetails.createdAt || new Date(),
          source: 'mobile_app'
        });
      }
      setOrderDetailsLogs(logs);
      setIsLoadingOrderLogs(false);
    }, (err) => {
      console.log('Error fetching order logs:', err);
      setIsLoadingOrderLogs(false);
    });

    return () => unsub();
  }, [selectedOrderForDetails, adminUid]);

  const canChangeOrderStatus = !isEmployee || userPermissions?.canChangeOrderStatus === true;
  const canDeleteOrders = !isEmployee || userPermissions?.canDeleteOrders === true;

  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ visible: false, order: null });

  const confirmDeleteOrder = (order) => {
    if (!canDeleteOrders) {
      setAlertModal({ visible: true, message: 'عذراً، ليس لديك صلاحية حذف الطلبات. يرجى مراجعة المسؤول لمنحك الصلاحية.' });
      return;
    }
    setDeleteConfirmModal({ visible: true, order });
  };

  const executeDeleteOrder = async () => {
    if (!deleteConfirmModal.order || !adminUid) return;
    if (!canDeleteOrders) {
      setAlertModal({ visible: true, message: 'عذراً، ليس لديك صلاحية حذف الطلبات.' });
      setDeleteConfirmModal({ visible: false, order: null });
      return;
    }
    const ord = deleteConfirmModal.order;
    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'users', adminUid, 'orders', ord.id.toString());

      if (Array.isArray(ord.items)) {
        for (const item of ord.items) {
          if (item.productId) {
            const prodRef = doc(db, 'users', adminUid, 'products', item.productId);
            const pSnap = await getDoc(prodRef);
            if (pSnap.exists()) {
              const pData = pSnap.data();
              let stock = { ...pData.stock };
              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (stock[firstStoreKey]) {
                stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - (item.quantity || 1));
                batch.update(prodRef, { stock });
              }
            }
          }
        }
      }

      batch.delete(orderRef);
      await batch.commit();

      const actor = getCurrentActorName();
      console.log('Order deleted successfully by:', actor);

      setDeleteConfirmModal({ visible: false, order: null });
      setSelectedOrderForDetails(null);
      setAlertModal({ visible: true, message: 'تم حذف الطلب وإعادة المواد للمخزن بنجاح.' });
    } catch(err) {
      console.log('Error deleting order:', err);
      setDeleteConfirmModal({ visible: false, order: null });
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء حذف الطلب.' });
    }
  };

  const STATUS_LABELS_MAP = {
    'pending': 'قيد الانتظار',
    'backordered': 'بانتظار المخزون',
    'processing': 'قيد المعالجة',
    'shipped': 'تم الشحن / مع المندوب',
    'delivered': 'تم التسليم (واصل)',
    'partial': 'واصل جزئي',
    'postponed': 'مؤجل',
    'returned': 'راجع',
    'returned_warehouse': 'راجع مستلم بالمخزن',
    'cancelled': 'ملغي'
  };

  const getCurrentActorName = () => {
    if (isEmployee) {
      return loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'موظف';
    }
    return user?.displayName || 'المدير';
  };

  const logOrderAction = async (orderId, actionType, details, customActor = null) => {
    try {
      if (!adminUid || !orderId) return;
      const logsRef = collection(db, 'users', adminUid, 'orders', orderId.toString(), 'logs');
      const actor = customActor || getCurrentActorName();
      await addDoc(logsRef, {
        action: actionType,
        details: details,
        employeeName: actor,
        timestamp: serverTimestamp(),
        source: 'mobile_app'
      });
    } catch (e) {
      console.log('Failed to write order log:', e);
    }
  };

  const applyStatusChange = async (newStatus) => {
    if (!statusChangeModal.order || !adminUid) return;
    if (!canChangeOrderStatus) {
      setAlertModal({ visible: true, message: 'عذراً، ليس لديك صلاحية تعديل حالة الطلب. يرجى مراجعة المسؤول.' });
      return;
    }
    const order = statusChangeModal.order;
    const oldStatus = order.status || 'pending';
    if (oldStatus === newStatus) {
      setStatusChangeModal({ visible: false, order: null });
      return;
    }
    try {
      const oRef = doc(db, 'users', adminUid, 'orders', order.id);
      await updateDoc(oRef, { 
        status: newStatus, 
        updatedAt: serverTimestamp() 
      });

      const oldStatusLabel = STATUS_LABELS_MAP[oldStatus] || oldStatus;
      const newStatusLabel = STATUS_LABELS_MAP[newStatus] || newStatus;
      const actor = getCurrentActorName();

      await logOrderAction(
        order.id,
        'تغيير حالة',
        `تم تغيير الحالة من "${oldStatusLabel}" إلى "${newStatusLabel}" بواسطة الموظف ${actor} عبر تطبيق الهاتف`,
        actor
      );

      lastLocalActionOrderId.current = order.id;
      await sendAppNotification({
        title: `🔄 تحديث حالة الطلب #${order.receiptNumber || order.id}`,
        body: `تم تغيير الحالة من "${oldStatusLabel}" إلى "${newStatusLabel}" بواسطة: ${actor}`,
        type: 'status_changed',
        orderId: order.id,
        receiptNumber: order.receiptNumber || order.id,
        customerName: order.customerName || '',
        actorName: actor,
        actorId: user?.uid,
        oldStatus: oldStatus,
        newStatus: newStatus
      });

      setStatusChangeModal({ visible: false, order: null });
      setAlertModal({ visible: true, message: 'تم تحديث حالة الطلب بنجاح.' });
    } catch(err) {
      console.log("Error updating status:", err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء تحديث حالة الطلب.' });
    }
  };

  const handleLogout = async () => {
    if (isEmployee && adminUid && user) {
      try {
        const sysUserRef = doc(db, 'users', adminUid, 'system_users', user.uid);
        await updateDoc(sysUserRef, { isOnline: false, lastActive: serverTimestamp() });
      } catch(e){}
    }
    await signOut(auth);
  };

  // Listen for Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        try {
          const mappingRef = doc(db, 'employee_mappings', usr.uid);
          const mappingSnap = await getDoc(mappingRef);
          if (mappingSnap.exists()) {
             const data = mappingSnap.data();
             setAdminUid(data.adminUid);
             setSelectedEmployeeId(data.employeeId);
             setLoggedInEmployeeId(data.employeeId);
             setIsEmployee(true);
             setUserPermissions(data.permissions || {});

             // Realtime listener on mapping permissions
             onSnapshot(mappingRef, (snap) => {
               if (snap.exists() && snap.data()?.permissions) {
                 setUserPermissions(snap.data().permissions);
               }
             });
             
             try {
                const sysUserRef = doc(db, 'users', data.adminUid, 'system_users', usr.uid);
                onSnapshot(sysUserRef, (snap) => {
                  if (snap.exists()) {
                    const sData = snap.data();
                    if (sData.name) setLoggedInSystemUserName(sData.name);
                    if (sData.permissions) {
                      setUserPermissions(prev => ({ ...prev, ...sData.permissions }));
                    }
                  }
                });
                await updateDoc(sysUserRef, { isOnline: true, lastActive: serverTimestamp() });
             } catch(e){}
             
          } else {
             setAdminUid(usr.uid);
             setIsEmployee(false);
             setUserPermissions({ canChangeOrderStatus: true, canDeleteOrders: true });
          }
        } catch(err) {
           console.log("Error checking mapping", err);
           setAdminUid(usr.uid);
           setIsEmployee(false);
        }
      } else {
        setAdminUid(null);
        setIsEmployee(false);
      }
      setUser(usr);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Presence tracker (AppState)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextAppState => {
      if (isEmployee && adminUid && user) {
        try {
          const sysUserRef = doc(db, 'users', adminUid, 'system_users', user.uid);
          if (nextAppState === 'active') {
            await updateDoc(sysUserRef, { isOnline: true, lastActive: serverTimestamp() });
          } else if (nextAppState.match(/inactive|background/)) {
            await updateDoc(sysUserRef, { isOnline: false, lastActive: serverTimestamp() });
          }
        } catch(err) {
          console.log("Presence err", err);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isEmployee, adminUid, user]);

  // Animated Neon Glow for Search Input
  const neonAnim = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(neonAnim, {
          toValue: 0.95,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(neonAnim, {
          toValue: 0.45,
          duration: 1800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [neonAnim]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Firestore Databases
  const [orders, setOrders] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalCompletedCount: 0, partialCount: 0, ofdOrdersCount: 0, processedCount: 0,
    newCount: 0, postponedCount: 0, returnedCountCard: 0, cancelledCount: 0,
    todayOrdersCount: 0, todaySales: 0
  });
  const [teamStats, setTeamStats] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [baseProducts, setBaseProducts] = useState([]);
  const [compositeProductsData, setCompositeProductsData] = useState([]);
  const [customersDb, setCustomersDb] = useState([]);
  const [ordersMatches, setOrdersMatches] = useState([]);

  const [plusMenuVisible, setPlusMenuVisible] = useState(false);
  const [addExpenseModalVisible, setAddExpenseModalVisible] = useState(false);
  const [addBarcodeModalVisible, setAddBarcodeModalVisible] = useState(false);

  // Expense form states
  const [treasuryDb, setTreasuryDb] = useState([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCurrency, setNewExpenseCurrency] = useState('IQD');
  const [newExpenseWallet, setNewExpenseWallet] = useState('');
  const [newExpenseDetails, setNewExpenseDetails] = useState('');

  // Barcode receipt state
  const [newBarcodeReceipt, setNewBarcodeReceipt] = useState('');
  const [customReceiptNumber, setCustomReceiptNumber] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Full Add Expense states
  const [expenseTagsDb, setExpenseTagsDb] = useState([]);
  const [pagesStoresDb, setPagesStoresDb] = useState([]);
  const [branchesDb, setBranchesDb] = useState([]);
  const [expenseCategoriesDb, setExpenseCategoriesDb] = useState([]);
  const [walletsDb, setWalletsDb] = useState([]);
  
  const [expensePageId, setExpensePageId] = useState('');
  const [expenseBranchId, setExpenseBranchId] = useState('');
  const [expenseItemId, setExpenseItemId] = useState('');
  const [expenseSelectedTags, setExpenseSelectedTags] = useState([]);
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showExpenseDatePicker, setShowExpenseDatePicker] = useState(false);
  const [expenseImage, setExpenseImage] = useState(null);
  const [isUploadingExpense, setIsUploadingExpense] = useState(false);



  // Stats









  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [orderBookingEmployeeId, setOrderBookingEmployeeId] = useState('');
  const [bookingEmpModalVisible, setBookingEmpModalVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhone2, setCustomerPhone2] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [region, setRegion] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('كاش عند التوصيل');
  const [fbLoginId, setFbLoginId] = useState('');
  const [cart, setCart] = useState([]);
  const [customTotalAmount, setCustomTotalAmount] = useState(null);
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [advSearchGov, setAdvSearchGov] = useState('');
  const [advSearchMonth, setAdvSearchMonth] = useState('');
  const [advSearchYear, setAdvSearchYear] = useState('');
  const [advSearchDateFrom, setAdvSearchDateFrom] = useState(null);
  const [advSearchDateTo, setAdvSearchDateTo] = useState(null);
  const [showAdvSearchDateFromPicker, setShowAdvSearchDateFromPicker] = useState(false);
  const [showAdvSearchDateToPicker, setShowAdvSearchDateToPicker] = useState(false);
  const [advSearchReceipt, setAdvSearchReceipt] = useState('');
  const [advSearchName, setAdvSearchName] = useState('');
  const [advSearchPhone, setAdvSearchPhone] = useState('');
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [selectedGridStatus, setSelectedGridStatus] = useState(null);
  const [advancedSearchResults, setAdvancedSearchResults] = useState([]);
  const [advSearchStatus, setAdvSearchStatus] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  
  // Server Search State
  const [serverSearchQuery, setServerSearchQuery] = useState('');
  const [serverSearchResult, setServerSearchResult] = useState(null);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  
  
  const parseOrderDate = (ord) => {
    if (!ord) return null;
    const candidates = [ord.date, ord.createdAt, ord.rawCreatedAt, ord.updatedAt];
    for (const val of candidates) {
      if (!val) continue;
      if (typeof val?.toDate === 'function') {
        const d = val.toDate();
        if (!isNaN(d.getTime())) return d;
      }
      if (val.seconds) {
        const d = new Date(val.seconds * 1000);
        if (!isNaN(d.getTime())) return d;
      }
      if (val instanceof Date && !isNaN(val.getTime())) {
        return val;
      }
      if (typeof val === 'string') {
        if (val.includes('/')) {
          const parts = val.split('/');
          if (parts.length === 3) {
            const dd = parseInt(parts[0], 10);
            const mm = parseInt(parts[1], 10) - 1;
            const yyyy = parseInt(parts[2].split(' ')[0], 10);
            const d = new Date(yyyy, mm, dd, 12, 0, 0);
            if (!isNaN(d.getTime())) return d;
          }
        }
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  };

  const executeAdvancedSearch = () => {
    const hasSearchCriteria = !!(advSearchGov || advSearchMonth || advSearchYear || advSearchDateFrom || advSearchDateTo || advSearchReceipt || advSearchPhone || advSearchStatus);
    if (!hasSearchCriteria && !selectedGridStatus) {
      setAdvancedSearchResults([]);
      return;
    }

    const result = orders.filter((ord) => {
      let match = true;
      
      if (advSearchGov && advSearchGov.trim()) {
        if (!String(ord.governorate || '').toLowerCase().includes(advSearchGov.toLowerCase().trim())) match = false;
      }
      
      const orderDateObj = parseOrderDate(ord);
      const isValidDate = orderDateObj && !isNaN(orderDateObj.getTime());
      
      if (advSearchMonth && advSearchMonth.trim()) {
        if (!isValidDate) {
          match = false;
        } else {
          const orderMonth = String(orderDateObj.getMonth() + 1).padStart(2, '0');
          if (orderMonth !== String(advSearchMonth).padStart(2, '0')) match = false;
        }
      }
      if (advSearchYear && advSearchYear.trim()) {
        if (!isValidDate) {
          match = false;
        } else {
          const orderYear = String(orderDateObj.getFullYear());
          if (orderYear !== String(advSearchYear).trim()) match = false;
        }
      }
      if (advSearchDateFrom || advSearchDateTo) {
        if (isValidDate) {
          if (advSearchDateFrom) {
             const f = new Date(advSearchDateFrom); 
             f.setHours(0, 0, 0, 0);
             if (orderDateObj < f) match = false;
          }
          if (advSearchDateTo) {
             const t = new Date(advSearchDateTo); 
             t.setHours(23, 59, 59, 999);
             if (orderDateObj > t) match = false;
          }
        } else {
          match = false;
        }
      }
      
      if (advSearchReceipt && advSearchReceipt.trim()) {
        if (!String(ord.receiptNumber || ord.id || '').toLowerCase().includes(advSearchReceipt.toLowerCase().trim())) match = false;
      }
      
      if (advSearchPhone && advSearchPhone.trim()) {
        const p1 = String(ord.customerPhone || '').toLowerCase();
        const p2 = String(ord.customerPhone2 || '').toLowerCase();
        const term = advSearchPhone.toLowerCase().trim();
        if (!p1.includes(term) && !p2.includes(term)) match = false;
      }
      
      if (advSearchStatus && advSearchStatus.trim()) {
        if (ord.status !== advSearchStatus) match = false;
      }
      
      return match;
    });

    setAdvancedSearchResults(result);
  };

  const handleServerSearch = async () => {
    if (!serverSearchQuery.trim()) {
      setServerSearchResult(null);
      return;
    }
    setIsSearchingServer(true);
    setServerSearchResult(null);
    try {
       let q = fsQuery(collection(db, 'users', adminUid, 'orders'), where('receiptNumber', '==', serverSearchQuery.trim()));
       let snap = await getDocs(q);
       
       if (snap.empty) {
          // Try customerPhone
          q = fsQuery(collection(db, 'users', adminUid, 'orders'), where('customerPhone', '==', serverSearchQuery.trim()));
          snap = await getDocs(q);
       }
       if (snap.empty) {
          // Try id
          const docRef = doc(db, 'users', adminUid, 'orders', serverSearchQuery.trim());
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
             setServerSearchResult([{ id: docSnap.id, ...docSnap.data() }]);
             setIsSearchingServer(false);
             return;
          }
       }
       
       if (!snap.empty) {
         setServerSearchResult(snap.docs.map(d => ({ id: d.id, ...d.data() })));
       } else {
         setServerSearchResult([]); // not found
       }
    } catch (e) {
       console.log("Server search error:", e);
    }
    setIsSearchingServer(false);
  };
  
  // Edit Order State
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editOrderStatus, setEditOrderStatus] = useState('pending');
  const [originalOrderDetails, setOriginalOrderDetails] = useState(null);
  const [originalOrderItems, setOriginalOrderItems] = useState([]);
  const [originalOrderStatus, setOriginalOrderStatus] = useState('pending');

  // Search State
  const [productSearch, setProductSearch] = useState('');
  
  // Global Date Filter
  const [globalDateFilter, setGlobalDateFilter] = useState('last_7_days');
  const [tempGlobalDateFilter, setTempGlobalDateFilter] = useState('last_7_days');
  const [tempCustomStartDate, setTempCustomStartDate] = useState(new Date());
  const [tempCustomEndDate, setTempCustomEndDate] = useState(new Date());
  const [tempFilterMonth, setTempFilterMonth] = useState(new Date().getMonth());
  const [tempFilterYear, setTempFilterYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [displayedOrdersCount, setDisplayedOrdersCount] = useState(100);
  const [phoneSearchMatches, setPhoneSearchMatches] = useState([]);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setDisplayedOrdersCount(100);
  }, [activeTab, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, ordersFilter, completedSubTab, ordersSearchQuery, completedSearchQuery]);

  // Custom Modal Visibilities
  const [empModalVisible, setEmpModalVisible] = useState(false);
  const [govModalVisible, setGovModalVisible] = useState(false);
  const [prodModalVisible, setProdModalVisible] = useState(false);
  const [alertModal, setAlertModal] = useState({ visible: false, message: '' });
  
  // Submit loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const governoratesList = [
    "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "ذي قار",
    "كركوك", "الأنبار", "ديالى", "المثنى",
    "القادسية", "ميسان", "واسط", "صلاح الدين",
    "دهوك", "السليمانية", "بابل", "كربلاء"
  ];

  // Load Saved Employee
  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const saved = await AsyncStorage.getItem('selectedEmployeeId');
        if (saved) setSelectedEmployeeId(saved);
      } catch (err) {
        console.log("AsyncStorage error:", err);
      }
    };
    loadEmployee();
  }, []);

  // Date Range Helper
  const getDateRange = (filter) => {
    const now = new Date();
    let start, end;
    
    // Set end to end of today
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    switch (filter) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      case 'today_and_yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        break;
      case 'last_7_days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
        break;
      case 'last_30_days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
        break;
      case 'last_60_days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59, 0, 0, 0, 0);
        break;
      case 'last_90_days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        break;
      case 'all_time':
        return null;
      case 'specific_month':
        start = new Date(filterYear, filterMonth, 1, 0, 0, 0, 0);
        end = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59, 999);
        break;
      case 'custom':
        // set start to start of the day of customStartDate
        start = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate(), 0, 0, 0, 0);
        // set end to end of the day of customEndDate
        end = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate(), 23, 59, 59, 999);
        break;
      default:
        return null;
    }
    
    return { 
      start: Timestamp.fromDate(start), 
      end: Timestamp.fromDate(end) 
    };
  };

  // ------------------ NEW DATA FETCHING (PAGINATION + AGGREGATION) ------------------

  // Reset pagination when tab or filters change
  useEffect(() => {
    setDisplayedOrdersCount(100);
  }, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear]);

  // 1. Fetch Dashboard Stats & Team Stats
  useEffect(() => {
    if (!user || !adminUid) return;
    
    const fetchDashboardStats = async () => {
      try {
        let baseQuery = collection(db, 'users', adminUid, 'orders');
        const range = getDateRange(globalDateFilter);
        
        if (!range) {
            // ALL TIME: Use server-side counts (No composite index required)
            const qCompleted = fsQuery(baseQuery, where('status', 'in', ['delivered', 'delivered_settled']));
            const qPartial = fsQuery(baseQuery, where('status', 'in', ['partial', 'replaced']));
            const qOfd = fsQuery(baseQuery, where('status', 'in', ['ofd', 'shipped']));
            const qProcessed = fsQuery(baseQuery, where('status', 'in', ['processed', 'confirmed']));
            const qNew = fsQuery(baseQuery, where('status', 'in', ['pending', 'pending_warehouse', 'new']));
            const qPostponed = fsQuery(baseQuery, where('status', '==', 'postponed'));
            const qReturned = fsQuery(baseQuery, where('status', 'in', ['returned', 'returned_agent', 'returned_warehouse']));
            const qCancelled = fsQuery(baseQuery, where('status', '==', 'cancelled'));
    
            const [cCompleted, cPartial, cOfd, cProcessed, cNew, cPostponed, cReturned, cCancelled, cTotal] = await Promise.all([
              getCountFromServer(qCompleted), getCountFromServer(qPartial), getCountFromServer(qOfd),
              getCountFromServer(qProcessed), getCountFromServer(qNew), getCountFromServer(qPostponed),
              getCountFromServer(qReturned), getCountFromServer(qCancelled), getCountFromServer(baseQuery)
            ]);
    
            const sumAgg = await getAggregateFromServer(qCompleted, { totalAmount: sum('totalAmount') });
    
            setDashboardStats({
              totalCompletedCount: cCompleted.data().count,
              partialCount: cPartial.data().count,
              ofdOrdersCount: cOfd.data().count,
              processedCount: cProcessed.data().count,
              newCount: cNew.data().count,
              postponedCount: cPostponed.data().count,
              returnedCountCard: cReturned.data().count,
              cancelledCount: cCancelled.data().count,
              todayOrdersCount: cTotal.data().count,
              todaySales: sumAgg.data().totalAmount || 0,
            });
            
            // Team Stats
            if (employees && employees.length > 0) {
               const tStats = await Promise.all(employees.map(async emp => {
                  const empQ = fsQuery(baseQuery, where('employeeId', '==', emp.id));
                  const empTotal = await getCountFromServer(empQ);
                  const empDelivered = await getCountFromServer(fsQuery(empQ, where('status', 'in', ['delivered', 'delivered_settled'])));
                  const empReturned = await getCountFromServer(fsQuery(empQ, where('status', 'in', ['returned', 'returned_agent', 'returned_warehouse'])));
                  const empCancelled = await getCountFromServer(fsQuery(empQ, where('status', '==', 'cancelled')));
                  
                  return {
                     emp,
                     total: empTotal.data().count,
                     delivered: empDelivered.data().count,
                     returned: empReturned.data().count,
                     cancelled: empCancelled.data().count,
                     pending: Math.max(0, empTotal.data().count - empDelivered.data().count - empReturned.data().count - empCancelled.data().count)
                  };
               }));
               setTeamStats(tStats);
            }
        } else {
            // SPECIFIC DATE RANGE: Fetch documents and count client-side (Bypasses missing composite indexes)
            const dateQuery = fsQuery(baseQuery, where('date', '>=', range.start), where('date', '<=', range.end));
            const snap = await getDocs(dateQuery);
            
            let stats = {
              totalCompletedCount: 0, partialCount: 0, ofdOrdersCount: 0, processedCount: 0,
              newCount: 0, postponedCount: 0, returnedCountCard: 0, cancelledCount: 0,
              todayOrdersCount: 0, todaySales: 0
            };
            
            let tStatsMap = {};
            if (employees && employees.length > 0) {
               employees.forEach(emp => {
                   tStatsMap[emp.id] = { emp, total: 0, delivered: 0, returned: 0, cancelled: 0, pending: 0 };
               });
            }

            snap.forEach(doc => {
               const data = doc.data();
               const status = data.status;
               stats.todayOrdersCount++;
               
               if (['delivered', 'delivered_settled'].includes(status)) {
                   stats.totalCompletedCount++;
                   stats.todaySales += (Number(data.totalAmount) || 0);
               } else if (['partial', 'replaced'].includes(status)) {
                   stats.partialCount++;
               } else if (['ofd', 'shipped'].includes(status)) {
                   stats.ofdOrdersCount++;
               } else if (['processed', 'confirmed'].includes(status)) {
                   stats.processedCount++;
               } else if (['pending', 'pending_warehouse', 'new'].includes(status)) {
                   stats.newCount++;
               } else if (status === 'postponed') {
                   stats.postponedCount++;
               } else if (['returned', 'returned_agent', 'returned_warehouse'].includes(status)) {
                   stats.returnedCountCard++;
               } else if (status === 'cancelled') {
                   stats.cancelledCount++;
               }
               
               // Team Stats Logic
               if (data.employeeId && tStatsMap[data.employeeId]) {
                   tStatsMap[data.employeeId].total++;
                   if (['delivered', 'delivered_settled'].includes(status)) {
                       tStatsMap[data.employeeId].delivered++;
                   } else if (['returned', 'returned_agent', 'returned_warehouse'].includes(status)) {
                       tStatsMap[data.employeeId].returned++;
                   } else if (status === 'cancelled') {
                       tStatsMap[data.employeeId].cancelled++;
                   } else {
                       tStatsMap[data.employeeId].pending++;
                   }
               }
            });
            
            setDashboardStats(stats);
            if (employees && employees.length > 0) {
               setTeamStats(Object.values(tStatsMap));
            }
        }
      } catch (err) {
        console.log("Error fetching stats:", err);
      }
    };
    fetchDashboardStats();
  }, [globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user, employees]);

  // 2. Fetch Paginated Orders for Active Tab
  useEffect(() => {
    if (!user || !adminUid) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let ordersQuery = collection(db, 'users', adminUid, 'orders');
    const range = getDateRange(globalDateFilter);
    
    // We MUST limit the query to avoid downloading massive amounts of data and crashing the app.
    // Dashboard Stats are handled by the server separately, so this list only needs to show recent items.
    if (range) {
      ordersQuery = fsQuery(
        ordersQuery, 
        where('date', '>=', range.start), 
        where('date', '<=', range.end),
        orderBy('date', 'desc'),
        limit(800)
      );
    } else {
      ordersQuery = fsQuery(ordersQuery, orderBy('date', 'desc'), limit(800));
    }

    const unsub = onSnapshot(ordersQuery, (snapshot) => {
      let fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(o => o.isDeleted !== true);

      // Local Filtering based on tab
      if (activeTab === 'completed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['delivered', 'delivered_settled'].includes(o.status));
      } else if (activeTab === 'returned_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['returned', 'returned_agent', 'returned_warehouse'].includes(o.status));
      } else if (activeTab === 'postponed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => o.status === 'postponed');
      } else if (activeTab === 'pending_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['pending', 'pending_warehouse', 'new'].includes(o.status));
      } else if (activeTab === 'partial_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['partial', 'replaced'].includes(o.status));
      } else if (activeTab === 'processed_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['processed', 'confirmed'].includes(o.status));
      } else if (activeTab === 'ofd_shipments') {
        fetchedOrders = fetchedOrders.filter(o => ['ofd', 'shipped'].includes(o.status));
      } else if (activeTab === 'orders') {
        if (ordersFilter === 'completed') {
          fetchedOrders = fetchedOrders.filter(o => ['delivered', 'partial'].includes(o.status));
        } else if (ordersFilter === 'active') {
          fetchedOrders = fetchedOrders.filter(o => ['pending', 'new', 'ofd', 'shipped', 'postponed', 'processed', 'confirmed', 'pending_warehouse', 'backordered'].includes(o.status));
        }
      }

      // Slicing to the displayed count to avoid rendering lag
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      console.log("Error fetching orders:", error);
      setLoading(false);
    });
    
    return () => unsub();
  }, [activeTab, ordersFilter, globalDateFilter, customStartDate, customEndDate, filterMonth, filterYear, adminUid, user]);

  // Fetch active employees
  useEffect(() => {
    if (!user || !adminUid) {
      setEmployees([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', adminUid, 'employees'), (snapshot) => {
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeEmps = empData.filter((e) => e.isActive);
      setEmployees(activeEmps);
      if (!isEmployee && !selectedEmployeeId && activeEmps.length > 0) {
        setSelectedEmployeeId(activeEmps[0].id);
      }
    });
    return () => unsub();
  }, [user, adminUid, selectedEmployeeId, isEmployee]);

  // Fetch base products
  useEffect(() => {
    if (!user || !adminUid) {
      setBaseProducts([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', adminUid, 'products'), (snapshot) => {
      setBaseProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, adminUid]);

  // Fetch composite products
  useEffect(() => {
    if (!user || !adminUid) {
      setCompositeProductsData([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', adminUid, 'composite_products'), (snapshot) => {
      setCompositeProductsData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, adminUid]);

  // Fetch customers
  useEffect(() => {
    if (!user || !adminUid) {
      setCustomersDb([]);
      return;
    }
    
    const unsubExpCats = onSnapshot(collection(db, 'users', adminUid, 'expense_categories'), s => setExpenseCategoriesDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubWallets = onSnapshot(collection(db, 'users', adminUid, 'wallets'), s => setWalletsDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTags = onSnapshot(collection(db, 'users', adminUid, 'expense_tags'), s => setExpenseTagsDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPagesStores = onSnapshot(collection(db, 'users', adminUid, 'pages_stores'), s => setPagesStoresDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBranches = onSnapshot(collection(db, 'users', adminUid, 'categories'), s => setBranchesDb(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const unsub = onSnapshot(collection(db, 'users', adminUid, 'customers'), (snapshot) => {
      setCustomersDb(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, adminUid]);

  // Search orders archive for matching phone when customer phone length >= 10
  useEffect(() => {
    if (!user || !adminUid) {
      setOrdersMatches([]);
      return;
    }
    const phone = customerPhone.trim();
    if (phone.length < 10) {
      setOrdersMatches([]);
      return;
    }
    const searchOrders = async () => {
      try {
        const qPhone = fsQuery(
          collection(db, 'users', adminUid, 'orders'), 
          where('customerPhone', '>=', phone), 
          where('customerPhone', '<=', phone + '\uf8ff'),
          limit(3)
        );
        const snap = await getDocs(qPhone);
        const matches = [];
        snap.forEach(doc => {
          const d = doc.data();
          matches.push({
            id: 'ord-' + doc.id,
            name: d.customerName,
            phone: d.customerPhone,
            province: d.governorate,
            area: d.region,
            source: 'order'
          });
        });
        setOrdersMatches(matches);
      } catch (err) {
        console.log("Phone search error:", err);
      }
    };
    const timer = setTimeout(searchOrders, 300);
    return () => clearTimeout(timer);
  }, [customerPhone, user, adminUid]);

  // Combine products and composite packages
  const productsList = useMemo(() => {
    const merged = [...baseProducts];
    compositeProductsData.forEach(cp => {
      let minBundles = Infinity;
      if (cp.composition && cp.composition.length > 0) {
        for (const comp of cp.composition) {
          const prod = baseProducts.find(p => p.id === comp.itemId);
          if (!prod) { minBundles = 0; break; }
          let totalStock = 0;
          if (prod.stock) {
            for (const storeId in prod.stock) {
              totalStock += prod.stock[storeId].quantity || 0;
            }
          }
          const canMake = Math.floor(totalStock / comp.quantityNeeded);
          if (canMake < minBundles) minBundles = canMake;
        }
      } else {
        minBundles = 0;
      }
      if (minBundles === Infinity) minBundles = 0;

      merged.push({
        id: cp.id,
        name: cp.name,
        barcode: '',
        units: [{ selling: cp.sellingPrice || 0, type: 'بكج' }],
        stock: { 'virtual_store': { quantity: minBundles, unit: 'بكج' } },
        isComposite: true,
        composition: cp.composition || []
      });
    });
    return merged;
  }, [baseProducts, compositeProductsData]);

  // Autocomplete phone list
  const filteredCustomersByPhone = useMemo(() => {
    const phoneQuery = customerPhone.trim();
    if (phoneQuery.length < 10) return [];
    const list = [];
    const matched = customersDb
      .filter(c => c.phone.includes(phoneQuery))
      .map(c => ({ ...c, source: 'customer' }));
    list.push(...matched);
    ordersMatches.forEach(om => {
      if (om.phone.includes(phoneQuery) && !list.find(i => i.phone === om.phone)) {
        list.push(om);
      }
    });
    return list;
  }, [customersDb, ordersMatches, customerPhone]);

  const handleSelectCustomer = (cust) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setGovernorate(cust.province || cust.governorate || '');
    setRegion(cust.area || cust.region || '');
    setPhoneSearchMatches([]);
  };

  const handleAddReplaceNote = () => {
    const tag = "استبدال هذا الطلب";
    setNotes(prev => prev.includes(tag) ? prev : prev ? `${prev}\n${tag}` : tag);
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        const price = (product.units && product.units.length > 0) ? product.units[0].selling : 0;
        return [...prev, { id: product.id, product, quantity: 1, unitPrice: price }];
      }
    });
    setProductSearch('');
    setProdModalVisible(false);
  };

  const updateCartQuantity = (id, qty) => {
    if (qty < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const updateCartUnitPrice = (id, price) => {
    if (price < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, unitPrice: price } : item));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const calculatedTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalAmount = customTotalAmount !== null && customTotalAmount !== '' ? (parseInt(customTotalAmount.replace(/[^0-9]/g, '')) || 0) : calculatedTotal;

  useEffect(() => {
    setCustomTotalAmount(null);
  }, [cart]);

  const filteredProductsSearch = productsList.filter(p => {
    if (!productSearch) return true;
    return p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.toLowerCase() === productSearch.toLowerCase();
  });

  const selectEmployee = async (emp) => {
    setSelectedEmployeeId(emp.id);
    setEmpModalVisible(false);
    try {
      await AsyncStorage.setItem('selectedEmployeeId', emp.id);
    } catch (err) {
      console.log(err);
    }
  };

  const isValidPhoneNumber = (phone) => {
    return /^(\+?\d{10,15})$/.test(phone.replace(/\s+/g, ''));
  };

  const handleAuthSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف وكلمة المرور.' });
      return;
    }
    if (authMode === 'register' && password !== confirmPassword) {
      setAlertModal({ visible: true, message: 'كلمتا المرور غير متطابقتين.' });
      return;
    }
    setIsSubmitting(true);
    try {
      let finalEmail = email.trim().replace(/[\s\-]/g, '');
      finalEmail = finalEmail.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
      if (!finalEmail.includes('@')) {
        finalEmail = `${finalEmail}@mansa.app`;
      }
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, finalEmail, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
        const userId = userCredential.user.uid;
        
        // Initialize User Data
        const batch = writeBatch(db);
        
        // 1. Order Counter
        const counterRef = doc(db, 'users', userId, 'metadata', 'orderCounter');
        batch.set(counterRef, { lastId: 100000 });
        
        // 2. Default Employee
        const empRef = doc(collection(db, 'users', userId, 'employees'));
        batch.set(empRef, {
          name: 'المسؤول (الافتراضي)',
          isActive: true,
          createdAt: new Date().toISOString()
        });
        
        // 3. Default Product
        const prodRef = doc(collection(db, 'users', userId, 'products'));
        batch.set(prodRef, {
          name: 'منتج تجريبي 1',
          price: 25000,
          code: 'TEST-01',
          stock: {
            default_store: {
              quantity: 100,
              reserved: 0,
              unit: 'قطعة'
            }
          },
          units: [{ type: 'قطعة', count: 1 }]
        });
        
        await batch.commit();
      }
    } catch (err) {
      console.log("Auth error:", err);
      let errMsg = 'حدث خطأ أثناء الاتصال. يرجى المحاولة لاحقاً.';
      if (err.code === 'auth/invalid-email') errMsg = 'البريد الإلكتروني أو رقم الهاتف غير صالح.';
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') errMsg = 'البريد الإلكتروني / رقم الهاتف أو كلمة المرور غير صحيحة.';
      else if (err.code === 'auth/email-already-in-use') errMsg = 'البريد الإلكتروني أو رقم الهاتف مسجل بالفعل.';
      else if (err.code === 'auth/weak-password') errMsg = 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).';
      else if (err.code === 'auth/invalid-credential') errMsg = 'البريد الإلكتروني / رقم الهاتف أو كلمة المرور غير صحيحة.';
      setAlertModal({ visible: true, message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف أولاً.' });
      return;
    }
    let finalEmail = email.trim().replace(/[\s\-]/g, '');
    finalEmail = finalEmail.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    if (!finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@mansa.app`;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, finalEmail);
      setAlertModal({ visible: true, message: 'تم إرسال رابط إعادة تعيين كلمة المرور بنجاح.' });
    } catch (err) {
      console.log("Reset password error:", err);
      let errMsg = 'حدث خطأ أثناء إرسال رابط إعادة التعيين.';
      if (err.code === 'auth/user-not-found') errMsg = 'لا يوجد حساب مرتبط بهذا البريد أو الرقم.';
      else if (err.code === 'auth/invalid-email') errMsg = 'البريد الإلكتروني أو رقم الهاتف غير صالح.';
      setAlertModal({ visible: true, message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS !== 'web') {
      setAlertModal({ visible: true, message: 'تسجيل الدخول بجوجل مدعوم حالياً في نسخة الويب، يرجى استخدام البريد الإلكتروني على الجوال.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const userId = userCredential.user.uid;

      // If new user, seed their Firestore subcollections
      const counterRef = doc(db, 'users', userId, 'metadata', 'orderCounter');
      const counterSnap = await getDoc(counterRef);

      if (!counterSnap.exists()) {
        const batch = writeBatch(db);
        batch.set(counterRef, { lastId: 100000 });

        const empRef = doc(collection(db, 'users', userId, 'employees'));
        batch.set(empRef, {
          name: 'المسؤول (الافتراضي)',
          isActive: true,
          createdAt: new Date().toISOString()
        });

        const prodRef = doc(collection(db, 'users', userId, 'products'));
        batch.set(prodRef, {
          name: 'منتج تجريبي 1',
          price: 25000,
          code: 'TEST-01',
          stock: {
            default_store: {
              quantity: 100,
              reserved: 0,
              unit: 'قطعة'
            }
          },
          units: [{ type: 'قطعة', count: 1 }]
        });

        await batch.commit();
      }
    } catch (err) {
      console.log("Google Auth error:", err);
      let errMsg = 'حدث خطأ أثناء الاتصال بجوجل، يرجى المحاولة لاحقاً.';
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'تم إغلاق نافذة تسجيل الدخول.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'تسجيل الدخول بجوجل غير مفعّل في لوحة Firebase. يرجى تفعيله من قسم Authentication -> Sign-in method.';
      } else if (err.code === 'auth/unauthorized-domain') {
        errMsg = 'هذا النطاق (Domain) غير مصرح به في إعدادات Firebase لتسجيل الدخول بجوجل.';
      } else {
        errMsg = `${errMsg} (${err.code || err.message})`;
      }
      setAlertModal({ visible: true, message: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFieldInvalid = (val, type = '') => {
    if (!hasAttemptedSubmit) return false;
    if (type === 'phone') return !isValidPhoneNumber(val);
    return val.trim() === '';
  };

  
  const pickExpenseImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setExpenseImage(result.assets[0].uri);
    }
  };


  const handleSaveExpense = async () => {
    if (!newExpenseCategory || !newExpenseAmount || !newExpenseWallet) {
      setAlertModal({ visible: true, message: 'يرجى تعبئة الحقول الأساسية (الفئة، المبلغ، المحفظة)' });
      return;
    }
    
    setIsUploadingExpense(true);
    try {
      let uploadedImageUrl = '';
      if (expenseImage) {
        const response = await fetch(expenseImage);
        const blob = await response.blob();
        const filename = `expenses/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const storageRef = ref(storage, `users/${adminUid}/${filename}`);
        const uploadTask = await uploadBytesResumable(storageRef, blob);
        uploadedImageUrl = await getDownloadURL(storageRef);
      }

      const numAmount = Number(newExpenseAmount);
      const cat = expenseCategoriesDb.find(c => c.id === newExpenseCategory);
      const wallet = walletsDb.find(w => w.id === newExpenseWallet);
      
      const pg = pagesStoresDb.find(p => p.id === expensePageId);
      const br = branchesDb.find(b => b.id === expenseBranchId);
      const it = baseProducts.find(i => i.id === expenseItemId) || compositeProductsData.find(i => i.id === expenseItemId);
      
      const batch = writeBatch(db);
      const expenseRef = doc(collection(db, 'users', adminUid, 'expenses'));
      const treasuryRef = doc(collection(db, 'users', adminUid, 'treasury_transactions'));
      
      const dateStr = formatDateLocal(expenseDate);
      const timeStr = expenseDate.toTimeString().split(' ')[0];

      batch.set(expenseRef, {
        categoryId: newExpenseCategory,
        categoryName: cat?.name || '',
        amount: numAmount,
        currency: newExpenseCurrency,
        date: dateStr,
        time: timeStr,
        details: newExpenseDetails,
        walletId: newExpenseWallet,
        walletName: wallet?.name || '',
        pageId: expensePageId,
        pageName: pg?.name || '',
        branchId: expenseBranchId,
        branchName: br?.name || '',
        itemId: expenseItemId,
        itemName: it?.name || '',
        tags: expenseSelectedTags,
        imageUrl: uploadedImageUrl,
        isArchived: false,
        createdAt: serverTimestamp()
      });

      batch.set(treasuryRef, {
        type: 'withdraw',
        walletId: newExpenseWallet,
        amount: numAmount,
        currency: newExpenseCurrency,
        date: dateStr,
        time: timeStr,
        details: `مصروف فئة ${cat?.name || 'غير محدد'} - ${newExpenseDetails}`,
        createdAt: serverTimestamp(),
        isAutomated: true,
        expenseId: expenseRef.id
      });

      await batch.commit();

      // Reset
      setActiveTab('orders');
      setNewExpenseCategory('');
      setNewExpenseAmount('');
      setNewExpenseDetails('');
      setNewExpenseWallet('');
      setExpensePageId('');
      setExpenseBranchId('');
      setExpenseItemId('');
      setExpenseSelectedTags([]);
      setExpenseImage(null);
      setExpenseDate(new Date());
      setIsUploadingExpense(false);
      setAlertModal({ visible: true, message: 'تم إضافة المصروف بنجاح' });
    } catch(err) {
      console.log(err);
      setIsUploadingExpense(false);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الحفظ' });
    }
  };

  const handleBarcodeScanned = ({ type, data }) => {
    setScanned(true);
    setNewBarcodeReceipt(data);
  };

  const handleSaveBarcodeReceipt = async () => {
    if (!newBarcodeReceipt.trim()) {
      setAlertModal({ visible: true, message: 'يرجى إدخال رقم الوصل' });
      return;
    }
    try {
      const counterRef = doc(db, 'users', adminUid, 'metadata', 'orderCounter');
      let newOrderId = 100000;
      
      await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (counterDoc.exists()) {
            newOrderId = (counterDoc.data().lastId || 100000) + 1;
            transaction.update(counterRef, { lastId: newOrderId });
          } else {
            transaction.set(counterRef, { lastId: newOrderId });
          }
          
          const newOrderRef = doc(db, 'users', adminUid, 'orders', newOrderId.toString());
          const actor = isEmployee ? (loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير';
          transaction.set(newOrderRef, {
            receiptNumber: newBarcodeReceipt.trim(),
            bookingEmployeeId: orderBookingEmployeeId || 'agent',
            bookingEmployeeName: employees?.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',
            employeeId: loggedInEmployeeId || 'admin',
            employeeName: actor,
            customerName: actor,
            systemUser: actor,
            customerPhone: '',
            governorate: '',
            region: '',
            notes: 'تم إنشاؤه عبر وصل باركود',
            paymentMethod: 'cash',
            totalAmount: 0,
            items: [],
            date: serverTimestamp(),
            status: 'waiting',
            is_settled: false,
            source: 'mobile_app',
            createdVia: 'mobile_app'
          });
      });

      const actor = isEmployee ? (loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير';
      await logOrderAction(
        newOrderId.toString(),
        'إنشاء الطلب',
        `تم إنشاء وتثبيت الطلب من تطبيق الهاتف عبر الباركود برقم #${newBarcodeReceipt.trim()}`,
        actor
      );

      lastLocalActionOrderId.current = newOrderId.toString();
      await sendAppNotification({
        title: `📦 طلب وصل باركود #${newBarcodeReceipt.trim()}`,
        body: `تم إضافة وصل باركود جديد برقم #${newBarcodeReceipt.trim()} بواسطة الموظف: ${actor}`,
        type: 'order_created',
        orderId: newOrderId.toString(),
        receiptNumber: newBarcodeReceipt.trim(),
        customerName: actor,
        actorName: actor,
        actorId: user?.uid,
      });

      setAddBarcodeModalVisible(false);
      setNewBarcodeReceipt('');
      setAlertModal({ visible: true, message: 'تم إضافة الطلب بنجاح' });
    } catch(err) {
      console.log(err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الحفظ' });
    }
  };


  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);

    if (!user) {
      setAlertModal({ visible: true, message: 'يرجى تسجيل الدخول أولاً.' });
      return;
    }

    if (!orderBookingEmployeeId) {
      setAlertModal({ visible: true, message: 'يرجى اختيار الموظف أولاً.' });
      return;
    }

    if (
      
      !isValidPhoneNumber(customerPhone) ||
      governorate.trim() === '' ||
      region.trim() === ''
    ) {
      setAlertModal({ visible: true, message: 'يرجى ملء كافة البيانات المطلوبة للزبون.' });
      return;
    }

    if (cart.length === 0) {
      setAlertModal({ visible: true, message: 'سلة المشتريات فارغة!' });
      return;
    }

    setIsSubmitting(true);
    let orderDocId = null;

    try {
      const currentActor = isEmployee ? (loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير';
      const orderData = {
        bookingEmployeeId: orderBookingEmployeeId,
        bookingEmployeeName: employees.find(e => e.id === orderBookingEmployeeId)?.name || 'مجهول',
        employeeId: loggedInEmployeeId || 'admin',
        employeeName: currentActor,
        customerName: currentActor,
        systemUser: currentActor,
        customerPhone: customerPhone,
        customerPhone2: customerPhone2,
        governorate: governorate,
        region: region,
        notes: notes,
        paymentMethod: paymentMethod,
        fbLoginId: fbLoginId,
        totalAmount: totalAmount,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          isComposite: item.product.isComposite || false,
          composition: item.product.composition || null
        })),
        date: serverTimestamp(),
        status: 'pending',
        is_settled: false,
        source: 'mobile_app',
        createdVia: 'mobile_app'
      };

      const batch = writeBatch(db);
      const counterRef = doc(db, 'users', adminUid, 'metadata', 'orderCounter');
      let newOrderId = 100000;
        
      await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (counterDoc.exists()) {
            newOrderId = (counterDoc.data().lastId || 100000) + 1;
            transaction.update(counterRef, { lastId: newOrderId });
          } else {
            transaction.set(counterRef, { lastId: newOrderId });
          }
          
          const newOrderRef = doc(db, 'users', adminUid, 'orders', newOrderId.toString());
          orderData.receiptNumber = customReceiptNumber.trim() || newOrderId.toString();
          transaction.set(newOrderRef, orderData);
          orderDocId = newOrderRef.id;
      });

      // Reserve stock
      for (const item of cart) {
        const productData = item.product;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', adminUid, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let stock = { ...rawData.stock };
              let remainingToReserve = component.quantityNeeded * item.quantity;
              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (!stock[firstStoreKey]) {
                stock[firstStoreKey] = { quantity: 0, reserved: remainingToReserve, unit: rawData.units?.[0]?.type || 'قطعة' };
              } else {
                stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + remainingToReserve;
              }
              batch.update(rawProdRef, { stock });
            }
          }
        } else {
          const prodRef = doc(db, 'users', adminUid, 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let stock = { ...prodData.stock };
            let remainingToReserve = item.quantity;
            const firstStoreKey = Object.keys(stock)[0] || 'default_store';
            if (!stock[firstStoreKey]) {
              stock[firstStoreKey] = { quantity: 0, reserved: remainingToReserve, unit: prodData.units?.[0]?.type || 'قطعة' };
            } else {
              stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + remainingToReserve;
            }
            batch.update(prodRef, { stock });
          }
        }
      }

      await batch.commit();

      if (orderDocId) {
        await logOrderAction(
          orderDocId,
          'إنشاء الطلب',
          `تم إنشاء وتثبيت الطلب من تطبيق الهاتف برقم #${orderData.receiptNumber}`,
          orderData.systemUser
        );

        lastLocalActionOrderId.current = orderDocId;
        await sendAppNotification({
          title: `📦 طلب جديد #${orderData.receiptNumber}`,
          body: `العميل: ${orderData.customerName || 'زبون'} (${orderData.governorate || 'المحافظة'}) - المبلغ: ${Number(orderData.totalAmount || 0).toLocaleString()} د.ع | الموظف: ${orderData.systemUser}`,
          type: 'order_created',
          orderId: orderDocId,
          receiptNumber: orderData.receiptNumber,
          customerName: orderData.customerName,
          actorName: orderData.systemUser,
          actorId: user?.uid,
        });
      }

      // Trigger Webhook
      try {
        if (orderDocId) {
          fetch('https://management-easy-order.firebaseapp.com/api/webhooks/meta-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: cart[0]?.id,
              value: totalAmount,
              currency: 'IQD',
              phone: customerPhone,
              firstName: customerName.split(' ')[0] || customerName,
              state: governorate,
              externalId: orderDocId,
              fb_login_id: fbLoginId,
              userId: adminUid
            })
          }).catch(err => console.log("Webhook fail:", err));
        }
      } catch (webhookErr) {
        console.log("Failed to trigger webhook:", webhookErr);
      }

      setAlertModal({ visible: true, message: 'تم حفظ الطلب وتحديث المخزون بنجاح!' });
      
      // Reset Form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerPhone2('');
      setGovernorate('');
      setRegion('');
      setNotes('');
      setFbLoginId('');
      setCart([]);
      setCustomTotalAmount(null);
      setHasAttemptedSubmit(false);

    } catch (err) {
      console.log("Submit order native error:", err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOrder = (order) => {
    if (!canChangeOrderStatus) {
      setAlertModal({ visible: true, message: 'عذراً، ليس لديك صلاحية تعديل هذا الطلب. يرجى مراجعة المسؤول.' });
      return;
    }
    
    setEditingOrderId(order.id);
    setEditOrderStatus(order.status || 'pending');
    setOriginalOrderDetails(order);
    setOriginalOrderItems(order.items || []);
    setOriginalOrderStatus(order.status || 'pending');
    
    setCustomerName(order.customerName || '');
    setCustomerPhone(order.customerPhone || '');
    setCustomerPhone2(order.customerPhone2 || '');
    setGovernorate(order.governorate || '');
    setRegion(order.region || '');
    setNotes(order.notes || '');
    setPaymentMethod(order.paymentMethod || 'كاش عند التوصيل');
    setFbLoginId(order.fbLoginId || '');
    
    if (order.items && order.items.length > 0) {
      const reconstructedCart = order.items.map(item => ({
        id: item.productId,
        product: {
          id: item.productId,
          name: item.productName,
          isComposite: item.isComposite || false,
          composition: item.composition || null
        },
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }));
      setCart(reconstructedCart);
    } else {
      setCart([]);
    }
    
    if (order.bookingEmployeeId) {
      setOrderBookingEmployeeId(order.bookingEmployeeId);
    }
    if (order.receiptNumber) {
      setCustomReceiptNumber(order.receiptNumber);
    }
    setCustomTotalAmount(order.totalAmount ? order.totalAmount.toString() : null);
    setActiveTab('entry');
  };

  const resetOrderForm = () => {
    setEditingOrderId(null);
    setEditOrderStatus('pending');
    setOriginalOrderDetails(null);
    setOriginalOrderItems([]);
    setOriginalOrderStatus('pending');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerPhone2('');
    setGovernorate('');
    setRegion('');
    setNotes('');
    setFbLoginId('');
    setCart([]);
    setCustomReceiptNumber('');
    setCustomTotalAmount(null);
    setHasAttemptedSubmit(false);
    if (loggedInEmployeeId) {
      setOrderBookingEmployeeId(loggedInEmployeeId);
    }
  };

  const cancelEdit = () => {
    resetOrderForm();
    setActiveTab('orders');
  };

  const handleEditSubmit = async () => {
    setHasAttemptedSubmit(true);

    if (!user) {
      setAlertModal({ visible: true, message: 'يرجى تسجيل الدخول أولاً.' });
      return;
    }
    if (!orderBookingEmployeeId) {
      setAlertModal({ visible: true, message: 'يرجى اختيار الموظف أولاً.' });
      return;
    }
    if (
      
      !isValidPhoneNumber(customerPhone) ||
      governorate.trim() === '' ||
      region.trim() === ''
    ) {
      setAlertModal({ visible: true, message: 'يرجى ملء كافة البيانات المطلوبة للزبون.' });
      return;
    }
    if (cart.length === 0) {
      setAlertModal({ visible: true, message: 'سلة المشتريات فارغة!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const orderRef = doc(db, 'users', adminUid, 'orders', editingOrderId);
      const batch = writeBatch(db);
      
      const updates = {
        status: editOrderStatus,
        customerName,
        customerPhone,
        customerPhone2,
        governorate,
        region,
        notes,
        paymentMethod,
        fbLoginId,
        totalAmount,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          isComposite: item.product.isComposite || false,
          composition: item.product.composition || null
        })),
        updatedAt: serverTimestamp()
      };

      batch.update(orderRef, updates);

      const oldStatus = originalOrderStatus || 'pending';
      const statusChanged = editOrderStatus && editOrderStatus !== oldStatus;
      const oldStatusLabel = STATUS_LABELS_MAP[oldStatus] || oldStatus;
      const newStatusLabel = STATUS_LABELS_MAP[editOrderStatus] || editOrderStatus;
      const actor = getCurrentActorName();

      const logDetails = statusChanged
        ? `تم تعديل بيانات الطلب وتغيير الحالة من "${oldStatusLabel}" إلى "${newStatusLabel}" بواسطة الموظف ${actor} عبر تطبيق الهاتف`
        : `تم تعديل بيانات الطلب بواسطة الموظف ${actor} عبر تطبيق الهاتف`;

      const logsRef = collection(db, 'users', adminUid, 'orders', editingOrderId.toString(), 'logs');
      batch.set(doc(logsRef), {
        action: statusChanged ? 'تغيير حالة' : 'تعديل يدوي',
        details: logDetails,
        employeeName: actor,
        timestamp: serverTimestamp(),
        source: 'mobile_app'
      });

      if (statusChanged) {
        lastLocalActionOrderId.current = editingOrderId;
        sendAppNotification({
          title: `🔄 تحديث حالة الطلب #${customReceiptNumber || editingOrderId}`,
          body: `تم تغيير الحالة من "${oldStatusLabel}" إلى "${newStatusLabel}" بواسطة: ${actor}`,
          type: 'status_changed',
          orderId: editingOrderId,
          receiptNumber: customReceiptNumber || editingOrderId,
          customerName: customerName,
          actorName: actor,
          actorId: user?.uid,
          oldStatus: oldStatus,
          newStatus: editOrderStatus
        }).catch(err => console.log('sendAppNotification edit error:', err));
      }

      // Revert stock for original items
      for (const oldItem of originalOrderItems) {
        const productData = { isComposite: oldItem.isComposite, composition: oldItem.composition, id: oldItem.productId };
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', adminUid, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let stock = { ...rawData.stock };
              let qtyToRevert = component.quantityNeeded * oldItem.quantity;
              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (stock[firstStoreKey]) {
                stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToRevert);
                batch.update(rawProdRef, { stock });
              }
            }
          }
        } else {
          const prodRef = doc(db, 'users', adminUid, 'products', oldItem.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let stock = { ...prodData.stock };
            let qtyToRevert = oldItem.quantity;
            const firstStoreKey = Object.keys(stock)[0] || 'default_store';
            if (stock[firstStoreKey]) {
              stock[firstStoreKey].reserved = Math.max(0, (stock[firstStoreKey].reserved || 0) - qtyToRevert);
              batch.update(prodRef, { stock });
            }
          }
        }
      }

      // Reserve stock for new items
      for (const item of cart) {
        const productData = item.product;
        if (productData.isComposite && productData.composition) {
          for (const component of productData.composition) {
            const rawProdRef = doc(db, 'users', adminUid, 'products', component.itemId);
            const rawSnap = await getDoc(rawProdRef);
            if (rawSnap.exists()) {
              const rawData = rawSnap.data();
              let stock = { ...rawData.stock };
              let qtyToReserve = component.quantityNeeded * item.quantity;
              const firstStoreKey = Object.keys(stock)[0] || 'default_store';
              if (!stock[firstStoreKey]) {
                stock[firstStoreKey] = { quantity: 0, reserved: qtyToReserve, unit: rawData.units?.[0]?.type || 'قطعة' };
              } else {
                stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + qtyToReserve;
              }
              batch.update(rawProdRef, { stock });
            }
          }
        } else {
          const prodRef = doc(db, 'users', adminUid, 'products', item.product.id);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            let stock = { ...prodData.stock };
            let qtyToReserve = item.quantity;
            const firstStoreKey = Object.keys(stock)[0] || 'default_store';
            if (!stock[firstStoreKey]) {
              stock[firstStoreKey] = { quantity: 0, reserved: qtyToReserve, unit: prodData.units?.[0]?.type || 'قطعة' };
            } else {
              stock[firstStoreKey].reserved = (stock[firstStoreKey].reserved || 0) + qtyToReserve;
            }
            batch.update(prodRef, { stock });
          }
        }
      }

      await batch.commit();
      setAlertModal({ visible: true, message: 'تم تحديث الطلب والمخزون بنجاح!' });
      resetOrderForm();
      setActiveTab('orders');

    } catch (err) {
      console.log("Edit order native error:", err);
      setAlertModal({ visible: true, message: 'حدث خطأ أثناء التحديث.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const systemUserName = isEmployee ? (loggedInSystemUserName || employees.find(e => e.id === loggedInEmployeeId)?.name || 'مجهول') : 'المدير';

  const getArabicDate = () => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const now = new Date();
    const dayName = days[now.getDay()];
    const dayNum = now.getDate();
    const monthName = months[now.getMonth()];
    return `${dayName} ${dayNum} ${monthName}`;
  };

  const completedCount = dashboardStats.totalCompletedCount;
  const cancelledCountForTab = dashboardStats.cancelledCount;
  const activeOrdersCountForTab = dashboardStats.todayOrdersCount - completedCount - cancelledCountForTab - dashboardStats.returnedCountCard;

  const renderReportsIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Rect x="3" y="13" width="4" height="7" rx="1" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Rect x="10" y="4" width="4" height="16" rx="1" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Rect x="17" y="9" width="4" height="11" rx="1" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Rect x="3" y="13" width="4" height="7" rx="1" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Rect x="10" y="4" width="4" height="16" rx="1" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Rect x="17" y="9" width="4" height="11" rx="1" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Rect x="3" y="13" width="4" height="7" rx="1" stroke={strokeColor} strokeWidth={2} />
        <Rect x="10" y="4" width="4" height="16" rx="1" stroke={strokeColor} strokeWidth={2} />
        <Rect x="17" y="9" width="4" height="11" rx="1" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  const renderProfileIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Circle cx="12" cy="7" r="4" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Circle cx="12" cy="7" r="4" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={strokeColor} strokeWidth={2} />
        <Circle cx="12" cy="7" r="4" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

    const renderSearchIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Circle cx="11" cy="11" r="8" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M21 21l-4.3-4.3" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Circle cx="11" cy="11" r="8" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Path d="M21 21l-4.3-4.3" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Circle cx="11" cy="11" r="8" stroke={strokeColor} strokeWidth={2} />
        <Path d="M21 21l-4.3-4.3" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  const renderArchiveIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  
  const renderProductsIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
        )}
        <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke={strokeColor} strokeWidth={2} />
        <Path d="M3.27 6.96L12 12.01l8.73-5.05" stroke={strokeColor} strokeWidth={2} />
        <Path d="M12 22.08V12" stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

  const renderSettingsIcon = (active) => {
    const strokeColor = active ? '#e9d5ff' : '#64748b';
    const pathD = "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z";
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 3 }}>
        {active && (
          <>
            <Circle cx="12" cy="12" r="3" stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            <Path d={pathD} stroke="rgba(168, 85, 247, 0.22)" strokeWidth={6} />
            
            <Circle cx="12" cy="12" r="3" stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
            <Path d={pathD} stroke="rgba(168, 85, 247, 0.45)" strokeWidth={4} />
          </>
        )}
        <Circle cx="12" cy="12" r="3" stroke={strokeColor} strokeWidth={2} />
        <Path d={pathD} stroke={strokeColor} strokeWidth={2} />
      </Svg>
    );
  };

    const returnedCount = orders.filter(o => o.status === 'returned').length;
  const {
    totalCompletedCount,
    partialCount,
    ofdOrdersCount,
    processedCount,
    newCount,
    postponedCount,
    returnedCountCard,
    cancelledCount,
    todayOrdersCount,
    todaySales
  } = dashboardStats;

  const renderCustomCard = (label, value, bgColor, textColor, svgContent, isWhite, onPress = null) => {
    const CardContent = (
      <View style={{
        width: onPress ? '100%' : '48%', 
        backgroundColor: bgColor, 
        borderRadius: 12, 
        padding: 12, 
        minHeight: 100, 
        justifyContent: 'space-between'
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ 
            backgroundColor: isWhite ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.2)', 
            borderRadius: 8, 
            width: 32, 
            height: 32, 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              {svgContent}
            </Svg>
          </View>
          <Text style={{ color: textColor, fontSize: 32, fontWeight: '400' }}>{value}</Text>
        </View>
        <Text style={{ color: textColor, fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 10 }}>{label}</Text>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity 
          activeOpacity={0.7} 
          onPress={onPress}
          style={{ width: '48%' }}
        >
          {CardContent}
        </TouchableOpacity>
      );
    }
    
    return CardContent;
  };

  if (!isIntroFinished) {
    return <IntroVideoScreen onFinish={() => setIsIntroFinished(true)} />;
  }

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>جاري التحقق من الهوية...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor={isLightMode ? "#eaddf5" : "#121216"} />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>منصة منسا</Text>
            <Text style={styles.authSubtitle}>لوحة التحكم وإدارة المخازن والمبيعات</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>البريد الإلكتروني أو رقم الهاتف</Text>
              <TextInput
                style={styles.authInput}
                placeholder="077... أو user@email.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                keyboardType="default"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>كلمة المرور</Text>
              <TextInput
                style={styles.authInput}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {authMode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>تأكيد كلمة المرور</Text>
                <TextInput
                  style={styles.authInput}
                  placeholder="••••••••"
                  placeholderTextColor="#64748b"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            )}

            {authMode === 'login' && (
              <TouchableOpacity style={styles.forgotPasswordBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>نسيت كلمة المرور؟</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.authSubmitBtn}
              onPress={handleAuthSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.authSubmitBtnText}>
                  {authMode === 'login' ? '💾 دخول' : '✨ إنشاء حساب'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.authSeparatorContainer}>
              <View style={styles.authSeparatorLine} />
              <Text style={styles.authSeparatorText}>أو</Text>
              <View style={styles.authSeparatorLine} />
            </View>

            <TouchableOpacity 
              style={styles.authGoogleBtn}
              onPress={handleGoogleSignIn}
              disabled={isSubmitting}
            >
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </Svg>
              <Text style={styles.authGoogleBtnText}>تسجيل الدخول بواسطة Google</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.authToggleBtn}
              onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              <Text style={styles.authToggleText}>
                {authMode === 'login' ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Alert Modal */}
        <Modal
          visible={alertModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setAlertModal({ visible: false, message: '' })}
        >
          <View style={styles.alertBg}>
            <View style={styles.alertContent}>
              <Text style={styles.alertMessage}>{alertModal.message}</Text>
              <TouchableOpacity
                style={styles.alertBtn}
                onPress={() => setAlertModal({ visible: false, message: '' })}
              >
                <Text style={styles.alertBtnText}>حسناً</Text>
              </TouchableOpacity>
            </View>
            </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>جاري تحميل منصة منسا...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* In-App Notification Banner ("البردة التفاعلية العلوية داخل التطبيق") */}
      {inAppNotification && (
        <Animated.View
          style={{
            position: 'absolute',
            top: Platform.OS === 'android' ? 35 : 50,
            left: 12,
            right: 12,
            zIndex: 999999,
            transform: [{ translateY: inAppNotifAnim }],
            backgroundColor: isLightMode ? '#ffffff' : '#1e1b2e',
            borderRadius: 18,
            padding: 14,
            shadowColor: '#8b5cf6',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 25,
            borderWidth: 1.5,
            borderColor: '#8b5cf6',
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              const ordId = inAppNotification.data?.orderId;
              const recNum = inAppNotification.data?.receiptNumber;
              setInAppNotification(null);
              if (ordId || recNum) {
                openOrderDetailsById(ordId, recNum);
              }
            }}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(139, 92, 246, 0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                  {inAppNotification.title}
                </Text>
                <Text style={{ fontSize: 12, color: isLightMode ? '#475569' : '#cbd5e1', marginTop: 2, textAlign: 'right' }} numberOfLines={2}>
                  {inAppNotification.body}
                </Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#8b5cf6', borderRadius: 8, marginRight: 8 }}>
              <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>عرض 👁️</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor={isLightMode ? "#f4f0fa" : "#0d0d12"} />
      
      
      {/* Global Header & Search */}
      {activeTab !== 'settings' && (
      <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12', paddingBottom: 10 }}>
        {/* Top Row: Profile & Notifications */}
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 16, marginTop: 15 }}>
          {/* Right: Profile Info */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f3e8ff', justifyContent: 'center', alignItems: 'center', marginLeft: 12 }}>
              <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 18 }}>
                {systemUserName ? systemUserName.split(' ').slice(0,2).map(n => n[0]).join(' ') : '👤'}
              </Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>
              {systemUserName}
            </Text>
          </View>

          {/* Left: Action Icons */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            {/* User Icon */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => setActiveTab('settings')}
            >
              <Svg width={22} height={22} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2.5}>
                <Path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                <Circle cx='12' cy='7' r='4' />
              </Svg>
            </TouchableOpacity>

            {/* Notification Bell */}
            <TouchableOpacity 
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isLightMode ? '#fff' : '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => setIsNotificationsModalVisible(true)}
            >
              <Svg width={24} height={24} viewBox='0 0 24 24' fill='none' stroke={isLightMode ? '#0f172a' : '#e2e8f0'} strokeWidth={2}>
                <Path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                <Path d='M13.73 21a2 2 0 0 1-3.46 0' />
              </Svg>
              {unreadNotificationsCount > 0 && (
                <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 12, minWidth: 22, height: 22, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: isLightMode ? '#f8fafc' : '#0f172a' }}>
                  <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            

          </View>
        </View>
        
              </View>
      )}


      

      {/* Postponed Shipments Screen */}
      {activeTab === 'postponed_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#f97316', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>الطلبات المؤجلة ({orders.filter(o => o.status === 'postponed').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={postponedSearchQuery} onChangeText={setPostponedSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'postponed');
              if (postponedSearchQuery.trim()) {
                const q = postponedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#f97316' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>مؤجلة</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? item.totalAmount.toLocaleString() + ' د.ع' : '-'}</Text>
                       {item.postponeReason && <Text style={{ textAlign: 'right', color: '#f97316', marginTop: 5 }}>السبب: {item.postponeReason}</Text>}
                       
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </View>
        </View>
      )}

      {/* Returned Shipments Screen */}
      {activeTab === 'returned_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#ef4444', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                المرتجعات ({(() => {
                  let fc = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');
                  if (returnedSubTab === 'agent') fc = fc.filter(o => o.status === 'returned' || o.status === 'returned_agent');
                  else fc = fc.filter(o => o.status === 'returned_warehouse');
                  if (returnedSearchQuery.trim()) {
                    const q = returnedSearchQuery.toLowerCase();
                    fc = fc.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
                  }
                  return fc.length;
                })()})
              </Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={returnedSearchQuery} onChangeText={setReturnedSearchQuery} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 15, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' }}>
               {(() => {
                  const allR = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');
                  const agentC = allR.filter(o => o.status === 'returned' || o.status === 'returned_agent').length;
                  const warehouseC = allR.filter(o => o.status === 'returned_warehouse').length;
                  return (
                    <>
                       <TouchableOpacity style={{ flex: 1, paddingVertical: 10, backgroundColor: returnedSubTab === 'warehouse' ? '#ef4444' : '#fff' }} onPress={() => setReturnedSubTab('warehouse')}>
                         <Text style={{ textAlign: 'center', color: returnedSubTab === 'warehouse' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>راجع في المخزن ({warehouseC})</Text>
                       </TouchableOpacity>
                       <TouchableOpacity style={{ flex: 1, paddingVertical: 10, backgroundColor: returnedSubTab === 'agent' ? '#ef4444' : '#fff' }} onPress={() => setReturnedSubTab('agent')}>
                         <Text style={{ textAlign: 'center', color: returnedSubTab === 'agent' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>راجع عند المندوب ({agentC})</Text>
                       </TouchableOpacity>
                    </>
                  )
               })()}
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'returned' || o.status === 'returned_agent' || o.status === 'returned_warehouse');
              if (returnedSubTab === 'agent') filtered = filtered.filter(o => o.status === 'returned' || o.status === 'returned_agent');
              else filtered = filtered.filter(o => o.status === 'returned_warehouse');
              
              if (returnedSearchQuery.trim()) {
                const q = returnedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#ef4444' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? item.totalAmount.toLocaleString() + ' د.ع' : '-'}</Text>
                       
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </View>
        </View>
      )}

      
      {/* قيد الإنتظار Screen */}
      {activeTab === 'pending_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#27272a', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>قيد الإنتظار ({orders.filter(o => o.status === 'pending' || o.status === 'pending_warehouse' || o.status === 'new').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={pendingSearchQuery} onChangeText={setPendingSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'pending' || o.status === 'pending_warehouse' || o.status === 'new');
              if (pendingSearchQuery.trim()) {
                const q = pendingSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </View>
        </View>
      )}

      {/* شحنات اليوم Screen */}
      {activeTab === 'today_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#ffffff', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#333', fontSize: 18, fontWeight: 'bold' }}>الطلبات الكلية ({orders.length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={todaySearchQuery} onChangeText={setTodaySearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = [...orders];
              if (todaySearchQuery.trim()) {
                const q = todaySearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#333' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </View>
        </View>
      )}

      {/* جزئي او استبدال Screen */}
      {activeTab === 'partial_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#34d399', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>جزئي او استبدال ({orders.filter(o => o.status === 'partial' || o.status === 'replaced').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={partialSearchQuery} onChangeText={setPartialSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'partial' || o.status === 'replaced');
              if (partialSearchQuery.trim()) {
                const q = partialSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </View>
        </View>
      )}

      {/* تمت المعالجة Screen */}
      {activeTab === 'processed_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#34d399', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>تمت المعالجة ({orders.filter(o => o.status === 'processed' || o.status === 'confirmed').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={processedSearchQuery} onChangeText={setProcessedSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'processed' || o.status === 'confirmed');
              if (processedSearchQuery.trim()) {
                const q = processedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </View>
        </View>
      )}

      {/* في الطريق للشركة Screen */}
      {activeTab === 'ofd_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: '#eab308', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"></Svg></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>في الطريق للشركة ({orders.filter(o => o.status === 'processing' || o.status === 'confirmed' || o.status === 'ofd' || o.status === 'shipped').length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')}><Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></TouchableOpacity>
            </View>
            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/><Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></Svg>
               <TextInput style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }} placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)" value={ofdSearchQuery} onChangeText={setOfdSearchQuery} />
            </View>
          </View>
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              let filtered = orders.filter(o => o.status === 'processing' || o.status === 'confirmed' || o.status === 'ofd' || o.status === 'shipped');
              if (ofdSearchQuery.trim()) {
                const q = ofdSearchQuery.toLowerCase();
                filtered = filtered.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
              }
              if (filtered.length === 0) return <View style={{ marginTop: 50, alignItems: 'center' }}><Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text></View>;
              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
          </View>
        </View>
      )}

      {/* Main Tab View */}
      {activeTab === 'add_expense' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding} keyboardShouldPersistTaps="handled">
          <View style={[styles.formContainer, { backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 20, borderRadius: 12 }]}>
            
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#fff' }}>💸 إضافة مصروف</Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')} style={{ padding: 8, backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8 }}>
                <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8' }}>رجوع</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              
              {/* Right side fields (in RTL, row-reverse makes this the main grid) */}
              <View style={{ width: '100%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>البيان / التفاصيل</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', color: isLightMode ? '#000' : '#fff', textAlign: 'right', height: 100, textAlignVertical: 'top' }]}
                  placeholder="اكتب التفاصيل هنا..."
                  placeholderTextColor="#64748b"
                  multiline
                  value={newExpenseDetails}
                  onChangeText={setNewExpenseDetails}
                />
              </View>

              {/* Categories & Amounts */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الفئة</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={newExpenseCategory} onValueChange={setNewExpenseCategory} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الفئة..." value="" />
                    {expenseCategoriesDb.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>المبلغ</Text>
                <View style={{ flexDirection: 'row-reverse' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', color: isLightMode ? '#000' : '#fff', textAlign: 'right', marginLeft: 10 }]}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={newExpenseAmount}
                    onChangeText={setNewExpenseAmount}
                  />
                  <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8, width: 80 }}>
                    <Picker selectedValue={newExpenseCurrency} onValueChange={setNewExpenseCurrency} style={{ color: isLightMode ? '#000' : '#fff' }}>
                      <Picker.Item label="د.ع" value="IQD" />
                      <Picker.Item label="$" value="USD" />
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Wallets & Date */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>دفع من محفظة (إلزامي)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={newExpenseWallet} onValueChange={setNewExpenseWallet} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر المحفظة..." value="" />
                    {walletsDb.map(w => <Picker.Item key={w.id} label={w.name} value={w.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>التاريخ</Text>
                <TouchableOpacity 
                  style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', justifyContent: 'center' }]}
                  onPress={() => setShowExpenseDatePicker(true)}
                >
                  <Text style={{ color: isLightMode ? '#000' : '#fff', textAlign: 'center' }}>
                    {formatDateLocal(expenseDate)}
                  </Text>
                </TouchableOpacity>
                {showExpenseDatePicker && (
                  <DateTimePicker
                    value={expenseDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowExpenseDatePicker(false);
                      if (date) setExpenseDate(date);
                    }}
                  />
                )}
              </View>

              {/* Optionals: Page, Branch, Item */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>البيج (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expensePageId} onValueChange={setExpensePageId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر البيج..." value="" />
                    {pagesStoresDb.map(p => <Picker.Item key={p.id} label={p.name} value={p.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الفرع (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expenseBranchId} onValueChange={setExpenseBranchId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الفرع..." value="" />
                    {branchesDb.map(b => <Picker.Item key={b.id} label={b.name} value={b.id} />)}
                  </Picker>
                </View>
              </View>

              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>الصنف (اختياري)</Text>
                <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 8 }}>
                  <Picker selectedValue={expenseItemId} onValueChange={setExpenseItemId} style={{ color: isLightMode ? '#000' : '#fff' }}>
                    <Picker.Item label="اختر الصنف..." value="" />
                    {baseProducts.concat(compositeProductsData).map(p => <Picker.Item key={p.id} label={p.name} value={p.id} />)}
                  </Picker>
                </View>
              </View>

              {/* Image and Tags */}
              <View style={{ width: '48%', marginBottom: 15 }}>
                <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right' }}>صور الفاتورة / الوصل (اختياري)</Text>
                <TouchableOpacity onPress={pickExpenseImage} style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', padding: 15, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#a855f7', fontWeight: 'bold' }}>{expenseImage ? 'تم اختيار صورة (تغيير)' : '📁 اختيار صور الفاتورة'}</Text>
                </TouchableOpacity>
              </View>

            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={{ backgroundColor: '#a855f7', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 }}
              onPress={handleSaveExpense}
              disabled={isUploadingExpense}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{isUploadingExpense ? 'جاري الحفظ...' : '💾 حفظ العملية'}</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      ) : activeTab === 'entry' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding} keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            
            {/* Edit Mode Top Banner */}
            {editingOrderId && (
              <View style={{ 
                backgroundColor: isLightMode ? '#fffbeb' : '#1e1b4b', 
                borderRadius: 14, 
                borderWidth: 1.5, 
                borderColor: isLightMode ? '#f59e0b' : '#818cf8', 
                padding: 14, 
                marginBottom: 16,
                elevation: 3,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 4
              }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 22 }}>✏️</Text>
                    <View>
                      <Text style={{ color: isLightMode ? '#92400e' : '#e0e7ff', fontWeight: 'bold', fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', textAlign: 'right' }}>
                        أنت الآن في وضع تعديل الطلب
                      </Text>
                      <Text style={{ color: isLightMode ? '#b45309' : '#a5b4fc', fontSize: 13, textAlign: 'right' }}>
                        رقم الوصل: #{originalOrderDetails?.receiptNumber || editingOrderId.substring(0, 8)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      resetOrderForm();
                      setAlertModal({ visible: true, message: 'تم إلغاء التعديل والبدء بطلب جديد فارغ بنجاح.' });
                    }}
                    style={{ 
                      backgroundColor: '#ef4444', 
                      paddingHorizontal: 10, 
                      paddingVertical: 6, 
                      borderRadius: 8,
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>✕ إلغاء وبدء طلب جديد</Text>
                  </TouchableOpacity>
                </View>

                {/* Status Selector */}
                <View style={{ marginTop: 2 }}>
                  <Text style={{ color: isLightMode ? '#7c3aed' : '#c084fc', fontWeight: 'bold', fontSize: 13, marginBottom: 6, textAlign: 'right', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                    🔄 حالة الطلب الحالية:
                  </Text>
                  <View style={{ backgroundColor: isLightMode ? '#ffffff' : '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: isLightMode ? '#cbd5e1' : '#334155', overflow: 'hidden' }}>
                    <Picker
                      selectedValue={editOrderStatus}
                      onValueChange={(val) => setEditOrderStatus(val)}
                      style={{ color: isLightMode ? '#0f172a' : '#ffffff', height: 48 }}
                      dropdownIconColor={isLightMode ? '#0f172a' : '#ffffff'}
                    >
                      <Picker.Item label="🟡 قيد الانتظار" value="pending" />
                      <Picker.Item label="🟣 بانتظار المخزون" value="backordered" />
                      <Picker.Item label="🔵 قيد المعالجة" value="processing" />
                      <Picker.Item label="🚚 تم الشحن / مع المندوب" value="shipped" />
                      <Picker.Item label="🟢 تم التسليم (واصل)" value="delivered" />
                      <Picker.Item label="📦 واصل جزئي" value="partial" />
                      <Picker.Item label="🟠 مؤجل" value="postponed" />
                      <Picker.Item label="🔴 راجع" value="returned" />
                      <Picker.Item label="🏬 راجع مستلم بالمخزن" value="returned_warehouse" />
                      <Picker.Item label="⚫ ملغي" value="cancelled" />
                    </Picker>
                  </View>
                </View>
              </View>
            )}

            {/* Section Title */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18 }}>👤</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#e2e8f0', marginRight: 8 }}>بيانات الزبون والعنوان</Text>
            </View>

            {/* Employee Selector */}
            <View style={styles.formGroup}>
              <Text style={{ color: '#e9d5ff', fontWeight: 'bold', marginBottom: 8, textAlign: 'right' }}>موظفة الرد (التي حجزت الطلب) *</Text>
              <TouchableOpacity 
                style={[styles.modalTrigger, isFieldInvalid(orderBookingEmployeeId) && styles.inputError]}
                onPress={() => setBookingEmpModalVisible(true)}
              >
                <Text style={orderBookingEmployeeId ? styles.triggerText : styles.triggerPlaceholder}>
                  {orderBookingEmployeeId ? employees.find(e => e.id === orderBookingEmployeeId)?.name : "-- اختر موظفة الرد --"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Governorate Modal Selector */}
            <View style={styles.formGroup}>
              <TouchableOpacity 
                style={[styles.modalTrigger, isFieldInvalid(governorate) && styles.inputError]}
                onPress={() => setGovModalVisible(true)}
              >
                <Text style={governorate ? styles.triggerText : styles.triggerPlaceholder}>
                  {governorate || "المحافظة *"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Region */}
            <View style={styles.formGroup}>
              <TextInput 
                style={[styles.input, isFieldInvalid(region) && styles.inputError]}
                value={region}
                onChangeText={setRegion}
                placeholder="المنطقة / العنوان بالتفصيل *"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>

            {/* Input Phone */}
            <View style={styles.formGroup}>
              <TextInput 
                style={[styles.input, isFieldInvalid(customerPhone, 'phone') && styles.inputError]}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="رقم هاتف الزبون *"
                keyboardType="phone-pad"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              {filteredCustomersByPhone.length > 0 && (
                <View style={styles.phoneDropdown}>
                  {filteredCustomersByPhone.map((c) => (
                    <TouchableOpacity 
                      key={c.id} 
                      style={styles.dropdownItem}
                      onPress={() => handleSelectCustomer(c)}
                    >
                      <Text style={styles.dropdownItemTitle}>{c.name}</Text>
                      <Text style={styles.dropdownItemSubtitle}>{c.phone} | {c.province || c.governorate}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <TouchableOpacity style={styles.replaceBtn} onPress={handleAddReplaceNote}>
                  <Text style={styles.replaceBtnText}>🔄 استبدال</Text>
                </TouchableOpacity>
              </View>
              <TextInput 
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="ملاحظات أو تفاصيل أخرى حول التوصيل..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>

            {/* Cart Section */}
            <View style={styles.cartSection}>
              <View style={styles.cartHeaderRow}>
                <Text style={styles.cartLabel}>🛒 سلة منتجات الطلب</Text>
                <TouchableOpacity 
                  style={styles.addProdBtn}
                  onPress={() => setProdModalVisible(true)}
                >
                  <Text style={styles.addProdBtnText}>+ إضافة منتج</Text>
                </TouchableOpacity>
              </View>

              {/* Cart Items List */}
              {cart.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemLeft}>
                    <Text style={styles.cartItemName}>{item.product.name}</Text>
                    <View style={styles.cartPriceContainer}>
                      <TextInput
                        style={styles.cartPriceInput}
                        value={item.unitPrice === 0 ? '' : String(item.unitPrice)}
                        keyboardType="numeric"
                        onChangeText={(text) => {
                          const val = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                          updateCartUnitPrice(item.id, val);
                        }}
                        onEndEditing={() => {
                          if (item.unitPrice === undefined || item.unitPrice === null || isNaN(item.unitPrice)) {
                            updateCartUnitPrice(item.id, 0);
                          }
                        }}
                      />
                      <Text style={styles.currencyLabel}>د.ع</Text>
                      <Text style={styles.multiplierLabel}>×</Text>
                    </View>
                  </View>
                  <View style={styles.cartQtyControls}>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => updateCartQuantity(item.id, Math.max(1, item.quantity - 1))}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.cartQtyInput}
                      value={item.quantity === 0 ? '' : String(item.quantity)}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const val = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                        updateCartQuantity(item.id, val);
                      }}
                      onEndEditing={() => {
                        if (!item.quantity || item.quantity < 1) {
                          updateCartQuantity(item.id, 1);
                        }
                      }}
                    />
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => updateCartQuantity(item.id, item.quantity + 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.removeBtn} 
                      onPress={() => removeFromCart(item.id)}
                    >
                      <Text style={styles.removeBtnText}>✖</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {cart.length > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>المجموع النهائي:</Text>
                  <View style={styles.totalInputRow}>
                    <TextInput
                      style={styles.totalAmountInput}
                      value={customTotalAmount !== null ? customTotalAmount : (calculatedTotal === 0 ? '' : String(calculatedTotal))}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        let cleanVal = text.replace(/[^0-9]/g, '');
                        if (cleanVal.length > 1 && cleanVal.startsWith('0')) {
                          cleanVal = cleanVal.replace(/^0+/, '');
                          if (cleanVal === '') cleanVal = '0';
                        }
                        setCustomTotalAmount(cleanVal);
                      }}
                      onEndEditing={() => {
                        if (customTotalAmount === '0' || customTotalAmount === '') {
                          setCustomTotalAmount(null);
                        }
                      }}
                    />
                    <Text style={styles.totalCurrencyLabel}>د.ع</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyCartText}>السلة فارغة. اضغط على &quot;+ إضافة منتج&quot; للبدء.</Text>
              )}
            </View>

            {/* Payment Method */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>طريقة الدفع</Text>
              <View style={styles.paymentSelector}>
                {['كاش عند التوصيل', 'حوالة زين كاش', 'حوالة بنكية'].map((method) => (
                  <TouchableOpacity 
                    key={method}
                    style={[styles.paymentBtn, paymentMethod === method && styles.paymentBtnActive]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text style={[styles.paymentBtnText, paymentMethod === method && styles.paymentBtnTextActive]}>
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>


            {/* Submit & Action Buttons */}
            <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
              <TouchableOpacity 
                style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }, { flex: 1 }]}
                onPress={editingOrderId ? handleEditSubmit : handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingOrderId ? '💾 حفظ التعديلات' : '💾 حفظ وإرسال الطلب'}</Text>
                )}
              </TouchableOpacity>

              {editingOrderId && (
                <TouchableOpacity 
                  style={[styles.submitBtn, { backgroundColor: '#ef4444', flex: 1 }]}
                  onPress={cancelEdit}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitBtnText}>✕ إلغاء ورجوع للبحث</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>

      ) : activeTab === 'orders' ? (
        <ScrollView style={[styles.tabContent, { backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12' }]} contentContainerStyle={{ paddingBottom: 80 }}>
          
          {/* Main Header */}
          <View style={styles.ordersHeaderRow}>
            <View />
            <View>
              <Text style={styles.ordersHeaderTitle}>البحث المتقدم</Text>
              <Text style={styles.ordersHeaderSubtitle}>ابحث عن الطلبات بسهولة</Text>
            </View>
          </View>

          {/* Advanced Search Form */}
          <View style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', borderRadius: 16, padding: 15, marginHorizontal: 5, marginBottom: 20, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
            
            {/* Governorates */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Picker
                  selectedValue={advSearchGov}
                  style={{ width: '100%', height: 48, color: isLightMode ? '#1e293b' : '#f8fafc' }}
                  onValueChange={(itemValue) => setAdvSearchGov(itemValue)}
                  dropdownIconColor={isLightMode ? '#1e293b' : '#f8fafc'}
                >
                  <Picker.Item label="-- اختر المحافظة --" value="" color={isLightMode ? '#94a3b8' : '#64748b'} />
                  {governoratesList.map((gov, idx) => (
                    <Picker.Item key={idx} label={gov} value={gov} color={isLightMode ? '#1e293b' : '#000000'} />
                  ))}
                </Picker>
              </View>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M3 21h18" /><Path d="M9 8h1" /><Path d="M9 12h1" /><Path d="M9 16h1" /><Path d="M14 8h1" /><Path d="M14 12h1" /><Path d="M14 16h1" /><Path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /></Svg>
            </View>

            {/* Month and Year */}
            <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', overflow: 'hidden' }}>
                <Picker
                  selectedValue={advSearchMonth}
                  onValueChange={(itemValue) => setAdvSearchMonth(itemValue)}
                  style={{ color: isLightMode ? '#1e293b' : '#f8fafc', height: 48, width: '100%' }}
                  dropdownIconColor={isLightMode ? '#1e293b' : '#f8fafc'}
                >
                  <Picker.Item label="-- الشهر --" value="" />
                  <Picker.Item label="01" value="01" />
                  <Picker.Item label="02" value="02" />
                  <Picker.Item label="03" value="03" />
                  <Picker.Item label="04" value="04" />
                  <Picker.Item label="05" value="05" />
                  <Picker.Item label="06" value="06" />
                  <Picker.Item label="07" value="07" />
                  <Picker.Item label="08" value="08" />
                  <Picker.Item label="09" value="09" />
                  <Picker.Item label="10" value="10" />
                  <Picker.Item label="11" value="11" />
                  <Picker.Item label="12" value="12" />
                </Picker>
              </View>

              <View style={{ flex: 1, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', overflow: 'hidden' }}>
                <Picker
                  selectedValue={advSearchYear}
                  onValueChange={(itemValue) => setAdvSearchYear(itemValue)}
                  style={{ color: isLightMode ? '#1e293b' : '#f8fafc', height: 48, width: '100%' }}
                  dropdownIconColor={isLightMode ? '#1e293b' : '#f8fafc'}
                >
                  <Picker.Item label="-- اختر السنة --" value="" />
                  <Picker.Item label="2024" value="2024" />
                  <Picker.Item label="2025" value="2025" />
                  <Picker.Item label="2026" value="2026" />
                  <Picker.Item label="2027" value="2027" />
                  <Picker.Item label="2028" value="2028" />
                </Picker>
              </View>
            </View>

            {/* From / To Date */}
            <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 12 }}>
              {/* From Date */}
              <View style={{ 
                flex: 1, 
                backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', 
                borderRadius: 10, 
                height: 48, 
                borderWidth: 1.5, 
                borderColor: advSearchDateFrom ? '#8b5cf6' : (isLightMode ? '#e2e8f0' : '#334155'), 
                flexDirection: 'row-reverse', 
                alignItems: 'center', 
                paddingHorizontal: 8 
              }}>
                <TouchableOpacity 
                  onPress={() => setShowAdvSearchDateFromPicker(true)} 
                  style={{ flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ 
                    color: advSearchDateFrom ? (isLightMode ? '#7c3aed' : '#c084fc') : (isLightMode ? '#94a3b8' : '#64748b'), 
                    fontWeight: advSearchDateFrom ? 'bold' : 'normal', 
                    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', 
                    fontSize: 13 
                  }}>
                    {advSearchDateFrom ? formatDateLocal(advSearchDateFrom) : '📅 من تاريخ'}
                  </Text>
                </TouchableOpacity>
                {advSearchDateFrom && (
                  <TouchableOpacity 
                    onPress={() => setAdvSearchDateFrom(null)} 
                    style={{ padding: 6, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 6 }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* To Date */}
              <View style={{ 
                flex: 1, 
                backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', 
                borderRadius: 10, 
                height: 48, 
                borderWidth: 1.5, 
                borderColor: advSearchDateTo ? '#8b5cf6' : (isLightMode ? '#e2e8f0' : '#334155'), 
                flexDirection: 'row-reverse', 
                alignItems: 'center', 
                paddingHorizontal: 8 
              }}>
                <TouchableOpacity 
                  onPress={() => setShowAdvSearchDateToPicker(true)} 
                  style={{ flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ 
                    color: advSearchDateTo ? (isLightMode ? '#7c3aed' : '#c084fc') : (isLightMode ? '#94a3b8' : '#64748b'), 
                    fontWeight: advSearchDateTo ? 'bold' : 'normal', 
                    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', 
                    fontSize: 13 
                  }}>
                    {advSearchDateTo ? formatDateLocal(advSearchDateTo) : '📅 الى تاريخ'}
                  </Text>
                </TouchableOpacity>
                {advSearchDateTo && (
                  <TouchableOpacity 
                    onPress={() => setAdvSearchDateTo(null)} 
                    style={{ padding: 6, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 6 }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Receipt */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="رقم الوصل"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchReceipt}
                onChangeText={setAdvSearchReceipt}
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><Path d="M16 2v4" /><Path d="M8 2v4" /><Path d="M3 10h18" /></Svg>
            </View>

            

            {/* Customer Phone */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
              <TextInput
                style={{ flex: 1, textAlign: 'right', fontSize: 14, color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}
                placeholder="هاتف الزبون"
                placeholderTextColor={isLightMode ? '#94a3b8' : '#64748b'}
                value={advSearchPhone}
                onChangeText={setAdvSearchPhone}
                keyboardType="phone-pad"
              />
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>
            </View>

            {/* Status Custom Dropdown */}
            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 10, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}
                onPress={() => setShowStatusDropdown(true)}
              >
                <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={{ color: advSearchStatus ? (isLightMode ? '#1e293b' : '#f8fafc') : (isLightMode ? '#94a3b8' : '#64748b'), fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', fontSize: 14 }}>
                    {advSearchStatus === 'pending' ? 'قيد الانتظار' :
                     advSearchStatus === 'backordered' ? 'قيد الانتظار (مخزن)' :
                     advSearchStatus === 'processing' ? 'قيد المعالجة' :
                     advSearchStatus === 'shipped' ? 'تم الشحن' :
                     advSearchStatus === 'ofd' ? 'قيد التوصيل' :
                     advSearchStatus === 'delivered' ? 'مكتمل (لم تتم المحاسبة)' :
                     advSearchStatus === 'delivered_settled' ? 'مكتمل (تمت المحاسبة)' :
                     advSearchStatus === 'partial' ? 'واصل جزئي (لم تتم المحاسبة)' :
                     advSearchStatus === 'returned' ? 'راجع' :
                     advSearchStatus === 'returned_agent' ? 'راجع عند المندوب' :
                     advSearchStatus === 'returned_warehouse' ? 'راجع مخزن' :
                     advSearchStatus === 'postponed' ? 'مؤجل' :
                     advSearchStatus === 'cancelled' ? 'ملغي' :
                     'الحالة (الكل)'}
                  </Text>
                </View>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#3b82f6' : '#a855f7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><Path d="M22 2L11 13" /><Path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
              </TouchableOpacity>

              {/* Status Dropdown Modal */}
              <Modal visible={showStatusDropdown} transparent={true} animationType="fade" onRequestClose={() => setShowStatusDropdown(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }} activeOpacity={1} onPress={() => setShowStatusDropdown(false)}>
                  <TouchableOpacity activeOpacity={1} style={{ backgroundColor: isLightMode ? '#ffffff' : '#1e293b', borderRadius: 16, maxHeight: '80%', overflow: 'hidden' }}>
                    <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155', backgroundColor: isLightMode ? '#f8fafc' : '#0f172a' }}>
                      <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>اختر حالة الطلب</Text>
                    </View>
                    <ScrollView style={{ padding: 10 }}>
                      {[
                        { val: '', label: 'الحالة (الكل)', bg: isLightMode ? '#f1f5f9' : '#334155', text: isLightMode ? '#475569' : '#cbd5e1' },
                        { val: 'pending', label: 'قيد الانتظار', bg: 'rgba(251, 191, 36, 0.15)', text: isLightMode ? '#d97706' : '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' },
                        { val: 'backordered', label: 'قيد الانتظار (مخزن)', bg: 'rgba(139, 92, 246, 0.15)', text: isLightMode ? '#7c3aed' : '#a78bfa', border: 'rgba(139, 92, 246, 0.4)' },
                        { val: 'processing', label: 'قيد المعالجة', bg: 'rgba(249, 115, 22, 0.15)', text: isLightMode ? '#ea580c' : '#fb923c', border: 'rgba(249, 115, 22, 0.4)' },
                        { val: 'shipped', label: 'تم الشحن', bg: 'rgba(56, 189, 248, 0.15)', text: isLightMode ? '#0284c7' : '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' },
                        { val: 'ofd', label: 'قيد التوصيل', bg: 'rgba(99, 102, 241, 0.15)', text: isLightMode ? '#4f46e5' : '#818cf8', border: 'rgba(99, 102, 241, 0.4)' },
                        { val: 'delivered', label: 'مكتمل (لم تتم المحاسبة)', bg: 'rgba(16, 185, 129, 0.15)', text: isLightMode ? '#059669' : '#34d399', border: 'rgba(16, 185, 129, 0.4)' },
                        { val: 'delivered_settled', label: 'مكتمل (تمت المحاسبة)', bg: 'rgba(20, 184, 166, 0.15)', text: isLightMode ? '#0d9488' : '#2dd4bf', border: 'rgba(20, 184, 166, 0.4)' },
                        { val: 'partial', label: 'واصل جزئي (لم تتم المحاسبة)', bg: 'rgba(14, 165, 233, 0.15)', text: isLightMode ? '#0284c7' : '#38bdf8', border: 'rgba(14, 165, 233, 0.4)' },
                        { val: 'returned', label: 'راجع', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                        { val: 'returned_agent', label: 'راجع عند المندوب', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                        { val: 'returned_warehouse', label: 'راجع مخزن', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                        { val: 'postponed', label: 'مؤجل', bg: 'rgba(234, 179, 8, 0.15)', text: isLightMode ? '#ca8a04' : '#facc15', border: 'rgba(234, 179, 8, 0.4)' },
                        { val: 'cancelled', label: 'ملغي', bg: 'rgba(100, 116, 139, 0.15)', text: isLightMode ? '#475569' : '#94a3b8', border: 'rgba(100, 116, 139, 0.4)' }
                      ].map((item, idx) => (
                        <TouchableOpacity 
                          key={idx} 
                          style={{ 
                            paddingVertical: 12, paddingHorizontal: 15, marginBottom: 8, borderRadius: 10,
                            backgroundColor: item.bg, borderWidth: item.border ? 1 : 0, borderColor: item.border || 'transparent',
                            flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between'
                          }}
                          onPress={() => { setAdvSearchStatus(item.val); setShowStatusDropdown(false); }}
                        >
                          <Text style={{ fontSize: 15, fontWeight: 'bold', color: item.text, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{item.label}</Text>
                          {advSearchStatus === item.val && (
                            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={item.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6L9 17l-5-5"/></Svg>
                          )}
                        </TouchableOpacity>
                      ))}
                      <View style={{ height: 20 }} />
                    </ScrollView>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Modal>
            </View>

            {/* Action Buttons: Search & Clear */}
            <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 5 }}>
              <TouchableOpacity 
                style={{ 
                  flex: 2, 
                  backgroundColor: isLightMode ? '#3b82f6' : '#8b5cf6', 
                  paddingVertical: 14, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  shadowColor: isLightMode ? '#3b82f6' : '#8b5cf6', 
                  shadowOpacity: 0.3, 
                  shadowRadius: 5, 
                  elevation: 4,
                  flexDirection: 'row-reverse',
                  justifyContent: 'center',
                  gap: 8
                }}
                onPress={() => { 
                  Keyboard.dismiss();
                  setSelectedGridStatus(null); 
                  executeAdvancedSearch(); 
                  setIsSearchModalVisible(true);
                }}
              >
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><Circle cx="11" cy="11" r="8" /><Path d="m21 21-4.3-4.3" /></Svg>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>بدء البحث</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ 
                  flex: 1.2, 
                  backgroundColor: isLightMode ? '#fee2e2' : 'rgba(239, 68, 68, 0.15)', 
                  borderWidth: 1.5, 
                  borderColor: isLightMode ? '#fca5a5' : '#ef4444', 
                  paddingVertical: 14, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexDirection: 'row-reverse', 
                  gap: 6,
                  elevation: 1
                }}
                onPress={() => {
                  setAdvSearchGov('');
                  setAdvSearchMonth('');
                  setAdvSearchYear('');
                  setAdvSearchDateFrom(null);
                  setAdvSearchDateTo(null);
                  setAdvSearchReceipt('');
                  setAdvSearchName('');
                  setAdvSearchPhone('');
                  setAdvSearchStatus('');
                  setAdvancedSearchResults([]);
                  setSelectedGridStatus(null);
                  Keyboard.dismiss();
                  setAlertModal({ visible: true, message: 'تم مسح كافة حقول وتواريخ البحث بنجاح.' });
                }}
              >
                <Text style={{ fontSize: 16 }}>🗑️</Text>
                <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>مسح الحقول</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Results Modal */}
          <Modal visible={isSearchModalVisible} animationType="slide" onRequestClose={() => { setSelectedGridStatus(null); setIsSearchModalVisible(false); }}>
            <SafeAreaView style={{ flex: 1, backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: isLightMode ? '#fff' : '#1e293b', borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>نتائج البحث</Text>
                <TouchableOpacity onPress={() => { setSelectedGridStatus(null); setIsSearchModalVisible(false); }} style={{ padding: 8, backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8 }}>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 14 }}>إغلاق</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, padding: 20 }}>
          
            {(() => {
              // Only filter if at least one field is filled
              const hasSearchCriteria = !!(advSearchGov || advSearchMonth || advSearchYear || advSearchDateFrom || advSearchDateTo || advSearchReceipt || advSearchPhone || advSearchStatus);

              if (!hasSearchCriteria) {
                return (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, opacity: 0.5 }}>
                    <Svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={isLightMode ? '#94a3b8' : '#64748b'} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 15 }}><Circle cx="11" cy="11" r="8" /><Path d="m21 21-4.3-4.3" /></Svg>
                    <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8', fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>قم بإدخال معلومات للبحث عن الطلبات</Text>
                  </View>
                );
              }

              const filteredList = (!hasSearchCriteria) ? orders : advancedSearchResults;
              // Aggregate filtered list by status
              const statusCounts = {};
              filteredList.forEach(ord => {
                 const st = ord.status || 'unknown';
                 statusCounts[st] = (statusCounts[st] || 0) + 1;
              });

              const statusLabels = {
                 'pending': { label: 'قيد الانتظار', bg: 'rgba(251, 191, 36, 0.15)', text: isLightMode ? '#d97706' : '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' },
                 'backordered': { label: 'قيد الانتظار (مخزن)', bg: 'rgba(139, 92, 246, 0.15)', text: isLightMode ? '#7c3aed' : '#a78bfa', border: 'rgba(139, 92, 246, 0.4)' },
                 'processing': { label: 'قيد المعالجة', bg: 'rgba(249, 115, 22, 0.15)', text: isLightMode ? '#ea580c' : '#fb923c', border: 'rgba(249, 115, 22, 0.4)' },
                 'shipped': { label: 'تم الشحن', bg: 'rgba(56, 189, 248, 0.15)', text: isLightMode ? '#0284c7' : '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' },
                 'ofd': { label: 'قيد التوصيل', bg: 'rgba(99, 102, 241, 0.15)', text: isLightMode ? '#4f46e5' : '#818cf8', border: 'rgba(99, 102, 241, 0.4)' },
                 'delivered': { label: 'مكتمل (لم تتم المحاسبة)', bg: 'rgba(16, 185, 129, 0.15)', text: isLightMode ? '#059669' : '#34d399', border: 'rgba(16, 185, 129, 0.4)' },
                 'delivered_settled': { label: 'مكتمل (تمت المحاسبة)', bg: 'rgba(20, 184, 166, 0.15)', text: isLightMode ? '#0d9488' : '#2dd4bf', border: 'rgba(20, 184, 166, 0.4)' },
                 'partial': { label: 'واصل جزئي (لم تتم المحاسبة)', bg: 'rgba(14, 165, 233, 0.15)', text: isLightMode ? '#0284c7' : '#38bdf8', border: 'rgba(14, 165, 233, 0.4)' },
                 'returned': { label: 'راجع', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                 'returned_agent': { label: 'راجع عند المندوب', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                 'returned_warehouse': { label: 'راجع مخزن', bg: 'rgba(244, 63, 94, 0.15)', text: isLightMode ? '#e11d48' : '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
                 'postponed': { label: 'مؤجل', bg: 'rgba(234, 179, 8, 0.15)', text: isLightMode ? '#ca8a04' : '#facc15', border: 'rgba(234, 179, 8, 0.4)' },
                 'cancelled': { label: 'ملغي', bg: 'rgba(100, 116, 139, 0.15)', text: isLightMode ? '#475569' : '#94a3b8', border: 'rgba(100, 116, 139, 0.4)' },
                 'unknown': { label: 'غير معروف', bg: 'rgba(100, 116, 139, 0.15)', text: isLightMode ? '#475569' : '#94a3b8', border: 'rgba(100, 116, 139, 0.4)' }
              };

              if (selectedGridStatus) {
                 const statusList = filteredList.filter(o => (o.status || 'unknown') === selectedGridStatus);
                 const info = statusLabels[selectedGridStatus] || statusLabels['unknown'];
                 return (
                    <View style={{ flex: 1 }}>
                       <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, padding: 10, backgroundColor: info.bg, borderRadius: 8, borderWidth: 1, borderColor: info.border }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: info.text, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>طلبات: {info.label}</Text>
                          <TouchableOpacity onPress={() => setSelectedGridStatus(null)} style={{ padding: 6, backgroundColor: isLightMode ? '#fff' : '#1e293b', borderRadius: 6 }}>
                             <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 12 }}>رجوع للوحة</Text>
                          </TouchableOpacity>
                       </View>
                       <FlatList 
                          data={statusList}
                          keyExtractor={ord => ord.id}
                          initialNumToRender={10}
                          maxToRenderPerBatch={10}
                          windowSize={5}
                          contentContainerStyle={{ paddingBottom: 50 }}
                          renderItem={({item: ord}) => (
                             <View key={ord.id} style={{ 
                                backgroundColor: '#fde047', // Yellow background
                                borderRadius: 12, 
                                padding: 16, 
                                marginBottom: 15, 
                                shadowColor: '#000', 
                                shadowOffset: { width: 0, height: 2 }, 
                                shadowOpacity: 0.2, 
                                shadowRadius: 4, 
                                elevation: 3,
                                borderWidth: 1,
                                borderColor: '#eab308'
                             }}>
                                 {/* Top row: Receipt & Clean Status Badge */}
                                 <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                                       رقم الوصل : {ord.receiptNumber || (ord.id ? ord.id.substring(0,6) : '')}
                                    </Text>
                                    <View style={{ 
                                       backgroundColor: 'rgba(0,0,0,0.08)', 
                                       paddingHorizontal: 12, 
                                       paddingVertical: 5, 
                                       borderRadius: 8,
                                       borderWidth: 1,
                                       borderColor: 'rgba(0,0,0,0.15)'
                                    }}>
                                       <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                                          {info.label}
                                       </Text>
                                    </View>
                                 </View>

                                 {/* Fields */}
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    هاتف المستلم : {ord.customerPhone || ord.phone || '---'} {ord.customerPhone2 ? ` - ${ord.customerPhone2}` : ''}
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    المحافظة : {ord.governorate || '---'}
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    المنطقة : {ord.region || ord.address || 'غير محدد'}
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    مستخدم النظام : {ord.customerName || ord.systemUser || '---'}
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    الموظف المسؤول : {ord.bookingEmployeeName || ord.employeeName || '---'}
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    هاتف السائق : {ord.driverPhone || ord.deliveryPhone || '---'}
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    المنتجات : {
                                       Array.isArray(ord.items) && ord.items.length > 0 
                                          ? ord.items.map(p => `${p.productName || p.name || 'منتج'} (${p.quantity || 1})`).join('، ')
                                          : (Array.isArray(ord.products) && ord.products.length > 0 
                                                ? ord.products.map(p => `${p.name || p.productName || 'منتج'} (${p.quantity || 1})`).join('، ') 
                                                : 'بدون منتجات')
                                    }
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    الملاحظات : {ord.notes || 'لا توجد'}
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 6, textAlign: 'right', fontWeight: 'bold' }}>
                                    المبلغ الكلي : {Number(ord.totalAmount ?? ord.totalCost ?? ord.totalPrice ?? 0).toLocaleString('en-US')} د.ع
                                 </Text>
                                 <Text style={{ fontSize: 15, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal', marginBottom: 15, textAlign: 'right', fontWeight: 'bold' }}>
                                    تاريخ الطلب : {parseOrderDate(ord) ? formatDateLocal(parseOrderDate(ord)) : 'غير محدد'}
                                 </Text>

                                 {/* Action Buttons: 1. Full Details, 2. Status Change, 3. Edit Order */}
                                 <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 5 }}>
                                    <TouchableOpacity 
                                       onPress={() => setSelectedOrderForDetails(ord)}
                                       style={{ 
                                          flex: 1.3, 
                                          backgroundColor: '#0284c7', 
                                          paddingVertical: 10, 
                                          borderRadius: 12, 
                                          alignItems: 'center', 
                                          justifyContent: 'center',
                                          shadowColor: '#0284c7', 
                                          shadowOpacity: 0.3, 
                                          shadowRadius: 4, 
                                          elevation: 3,
                                          flexDirection: 'row-reverse',
                                          gap: 4
                                       }}
                                    >
                                       <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                                          👁️ تفاصيل الطلب
                                       </Text>
                                    </TouchableOpacity>

                                    {canChangeOrderStatus && (
                                       <TouchableOpacity 
                                          onPress={() => setStatusChangeModal({ visible: true, order: ord })}
                                          style={{ 
                                             flex: 1, 
                                             backgroundColor: '#8b5cf6', 
                                             paddingVertical: 10, 
                                             borderRadius: 12, 
                                             alignItems: 'center', 
                                             justifyContent: 'center',
                                             shadowColor: '#8b5cf6', 
                                             shadowOpacity: 0.3, 
                                             shadowRadius: 4, 
                                             elevation: 2,
                                             flexDirection: 'row-reverse',
                                             gap: 4
                                          }}
                                       >
                                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                                             🔄 الحالة
                                          </Text>
                                       </TouchableOpacity>
                                    )}

                                    {canChangeOrderStatus && (
                                       <TouchableOpacity 
                                          onPress={() => { 
                                             setSelectedGridStatus(null); 
                                             setIsSearchModalVisible(false); 
                                             setTimeout(() => handleEditOrder(ord), 300); 
                                          }}
                                          style={{ 
                                             flex: 1, 
                                             backgroundColor: '#eab308', 
                                             paddingVertical: 10, 
                                             borderRadius: 12, 
                                             alignItems: 'center', 
                                             justifyContent: 'center',
                                             shadowColor: '#000', 
                                             shadowOpacity: 0.1, 
                                             shadowRadius: 3, 
                                             elevation: 2,
                                             flexDirection: 'row-reverse',
                                             gap: 4
                                          }}
                                       >
                                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                                             ✏️ تعديل
                                          </Text>
                                       </TouchableOpacity>
                                    )}

                                    {canDeleteOrders && (
                                       <TouchableOpacity 
                                          onPress={() => confirmDeleteOrder(ord)}
                                          style={{ 
                                             width: 38,
                                             backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                             paddingVertical: 10, 
                                             borderRadius: 12, 
                                             alignItems: 'center', 
                                             justifyContent: 'center',
                                             borderWidth: 1,
                                             borderColor: 'rgba(239, 68, 68, 0.3)'
                                          }}
                                       >
                                          <Text style={{ fontSize: 14 }}>🗑️</Text>
                                       </TouchableOpacity>
                                    )}
                                 </View>
                             </View>
                          )}
                       />
                    </View>
                 );
              }

              return (
                <ScrollView contentContainerStyle={{ paddingBottom: 50, flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {Object.keys(statusCounts).map(st => {
                     const info = statusLabels[st] || statusLabels['unknown'];
                     return (
                        <TouchableOpacity 
                           key={st} 
                           style={{ width: '48%', backgroundColor: info.bg, borderWidth: 1, borderColor: info.border, borderRadius: 12, padding: 15, marginBottom: 15, alignItems: 'center', justifyContent: 'center' }}
                           onPress={() => setSelectedGridStatus(st)}
                        >
                           <Text style={{ fontSize: 28, fontWeight: 'bold', color: info.text, marginBottom: 5 }}>{statusCounts[st]}</Text>
                           <Text style={{ fontSize: 14, fontWeight: 'bold', color: info.text, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>{info.label}</Text>
                        </TouchableOpacity>
                     );
                  })}
                  
                  {/* Total Card */}
                  <View style={{ width: '100%', backgroundColor: isLightMode ? '#f1f5f9' : '#1e293b', borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', borderRadius: 12, padding: 20, marginBottom: 15, alignItems: 'center', justifyContent: 'center' }}>
                     <Text style={{ fontSize: 32, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', marginBottom: 5 }}>{filteredList.length}</Text>
                     <Text style={{ fontSize: 16, fontWeight: 'bold', color: isLightMode ? '#475569' : '#cbd5e1', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>المجموع الكلي للطلبات</Text>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
          </SafeAreaView>
          </Modal>
        </ScrollView>
      ) : activeTab === 'products_manager' ? (
        <View style={[styles.tabContent, { backgroundColor: isLightMode ? '#f8fafc' : '#0d0d12' }]}>
          {/* Segmented Control */}
          <View style={{ flexDirection: 'row-reverse', padding: 15, backgroundColor: isLightMode ? '#fff' : '#1e293b', borderBottomWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'products' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('products')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'products' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>الأصناف</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'categories' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('categories')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'categories' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>الفئات</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: productsTab === 'pages' ? '#a855f7' : 'transparent' }}
              onPress={() => setProductsTab('pages')}
            >
              <Text style={{ fontWeight: 'bold', color: productsTab === 'pages' ? '#a855f7' : (isLightMode ? '#64748b' : '#94a3b8') }}>البيجات</Text>
            </TouchableOpacity>
          </View>

          {/* Content Lists */}
          <ScrollView contentContainerStyle={{ padding: 15 }}>
            {productsTab === 'products' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>قائمة الأصناف ({baseProducts.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddProductModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة صنف</Text>
                  </TouchableOpacity>
                </View>
                {baseProducts.map(p => (
                  <View key={p.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{p.name}</Text>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 12 }}>
                      {/* Cost Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#fef2f2' : '#7f1d1d', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#ef4444' : '#fca5a5', marginBottom: 4, fontWeight: 'bold' }}>التكلفة</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#b91c1c' : '#fee2e2' }}>
                          {typeof p.cost === 'object' ? 0 : (p.cost || p.purchase || 0)}
                        </Text>
                      </View>

                      {/* Selling Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#f0fdf4' : '#14532d', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#22c55e' : '#86efac', marginBottom: 4, fontWeight: 'bold' }}>سعر البيع</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#15803d' : '#dcfce7' }}>
                          {typeof (p.selling || p.price) === 'object' ? 0 : (p.selling || p.price || 0)}
                        </Text>
                      </View>

                      {/* Quantity Card */}
                      <View style={{ flex: 1, backgroundColor: isLightMode ? '#eff6ff' : '#1e3a8a', padding: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, color: isLightMode ? '#3b82f6' : '#93c5fd', marginBottom: 4, fontWeight: 'bold' }}>العدد</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: isLightMode ? '#1d4ed8' : '#dbeafe' }}>
                          {(() => {
                            if (typeof p.totalBaseQuantity === 'number') return p.totalBaseQuantity;
                            let stk = p.stock || p.quantity;
                            if (typeof stk === 'number' || typeof stk === 'string') return stk;
                            if (typeof stk === 'object' && stk !== null) {
                              let t = 0;
                              Object.keys(stk).forEach(k => { t += Number(stk[k]?.quantity) || 0; });
                              return t;
                            }
                            return 0;
                          })()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {productsTab === 'categories' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>الفئات ({branchesDb.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddCategoryModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة فئة</Text>
                  </TouchableOpacity>
                </View>
                {branchesDb.map(c => (
                  <View key={c.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{c.name}</Text>
                  </View>
                ))}
              </>
            )}

            {productsTab === 'pages' && (
              <>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc' }}>البيجات ({pagesStoresDb.length})</Text>
                  <TouchableOpacity style={{ backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 }} onPress={() => setAddPageModalVisible(true)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ إضافة بيج</Text>
                  </TouchableOpacity>
                </View>
                {pagesStoresDb.map(pg => (
                  <View key={pg.id} style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: isLightMode ? '#1e293b' : '#fff', textAlign: 'right' }}>{pg.name}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
) : activeTab === 'settings' ? (
          <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
            {/* Settings Tab Content */}
            <View style={styles.tabHeaderCard}>
              <Text style={styles.tabHeaderTitle}>⚙️ إعدادات النظام</Text>
            </View>

            {/* Single Theme Switch Card */}
            <View style={styles.statCardBig}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.settingLabel}>مظهر التطبيق</Text>
                  <Text style={[styles.settingValue, { color: isLightMode ? '#7c3aed' : '#c084fc', marginTop: 3 }]}>
                    {isLightMode ? '☀️ الوضع الفاتح (النهاري)' : '🌙 الوضع الداكن (الليلي)'}
                  </Text>
                </View>
                <Switch 
                  value={isLightMode} 
                  onValueChange={toggleTheme} 
                  trackColor={{ false: '#334155', true: '#8b5cf6' }}
                  thumbColor={isLightMode ? '#ffffff' : '#94a3b8'}
                />
              </View>
            </View>

            {/* Current Employee Info (without change employee button) */}
            <View style={styles.statCardBig}>
              <Text style={styles.profileLabel}>الموظف الحالي</Text>
              <Text style={styles.profileValue}>{systemUserName || 'المسؤول'}</Text>
              <Text style={styles.profileDescription}>
                مسؤول عن إدخال وتعديل ومتابعة الطلبات.
              </Text>
            </View>

            {/* Account & Logout */}
            <View style={styles.statCardBig}>
              <Text style={styles.profileLabel}>الحساب المسجل</Text>
              <Text style={styles.profileValue}>{user?.email?.endsWith('@mansa.app') ? `📱 ${user.email.replace('@mansa.app', '')}` : `✉️ ${user?.email}`}</Text>
              <TouchableOpacity 
                style={[styles.profileSwitchBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', marginTop: 10 }]} 
                onPress={handleLogout}
              >
                <Text style={[styles.profileSwitchBtnText, { color: '#ef4444' }]}>🚪 تسجيل الخروج</Text>
              </TouchableOpacity>
            </View>

            {/* App Info & About */}
            <View style={styles.statCardBig}>
              <View style={{ width: '100%', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.settingLabel}>إصدار التطبيق:</Text>
                <Text style={styles.settingValue}>v1.2.0 (رقم البناء 48)</Text>
              </View>
              <View style={{ width: '100%', height: 1, backgroundColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)', marginVertical: 8 }} />
              <View style={{ width: '100%', alignItems: 'flex-end' }}>
                <Text style={styles.settingLabel}>عن منصة منسا:</Text>
                <Text style={[styles.settingValue, { color: isLightMode ? '#64748b' : '#94a3b8', fontSize: 13, marginTop: 4 }]}>
                  نظام إدارة ومتابعة الطلبات اللوجستية والمخازن المتكامل.
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : null}

      
      {activeTab === 'completed_shipments' && (
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          {/* Header */}
          <View style={{ backgroundColor: '#10b951', paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight || 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Filter Button Placeholder */}
              <TouchableOpacity onPress={() => {}}>
                 <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <Path d="M4 6h16M7 12h10M10 18h4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                 </Svg>
              </TouchableOpacity>
              
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                الشحنات المكتملة عدد الطلبيات { (() => {
                  let fc = orders.filter(o => (o.status === 'delivered' || o.status === 'delivered_settled'));
                  if (completedSubTab === 'accounted') fc = fc.filter(o => o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled')));
                  else fc = fc.filter(o => !(o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled'))));
                  if (completedSearchQuery.trim()) {
                    const q = completedSearchQuery.toLowerCase();
                    fc = fc.filter(o => (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) || (o.customerName && String(o.customerName).toLowerCase().includes(q)) || (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q)));
                  }
                  return fc.length;
                })() }
              </Text>

              {/* Back Button */}
              <TouchableOpacity onPress={() => setActiveTab('orders')}>
                 <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <Path d="M9 18l6-6-6-6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                 </Svg>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 15, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
               <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/>
                  <Path d="M21 21l-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
               </Svg>
               <TextInput 
                 style={{ flex: 1, marginLeft: 10, textAlign: 'right', color: '#333' }}
                 placeholder="بحث (رقم الوصل، اسم الزبون، الهاتف...)"
                 value={completedSearchQuery}
                 onChangeText={setCompletedSearchQuery}
               />
            </View>

            <View style={{ flexDirection: 'row', marginTop: 15, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' }}>
               {(() => {
                  const allC = orders.filter(o => (o.status === 'delivered' || o.status === 'delivered_settled'));
                  const acc = allC.filter(o => o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled'))).length;
                  const unacc = allC.length - acc;
                  return (
                    <>
                       <TouchableOpacity 
                          style={{ flex: 1, paddingVertical: 10, backgroundColor: completedSubTab === 'unaccounted' ? '#eab308' : '#fff' }}
                          onPress={() => setCompletedSubTab('unaccounted')}
                       >
                         <Text style={{ textAlign: 'center', color: completedSubTab === 'unaccounted' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>لم تتم المحاسبة ({unacc})</Text>
                       </TouchableOpacity>
                       <TouchableOpacity 
                          style={{ flex: 1, paddingVertical: 10, backgroundColor: completedSubTab === 'accounted' ? '#eab308' : '#fff' }}
                          onPress={() => setCompletedSubTab('accounted')}
                       >
                         <Text style={{ textAlign: 'center', color: completedSubTab === 'accounted' ? '#fff' : '#666', fontWeight: 'bold', fontSize: 13 }}>تم المحاسبة ({acc})</Text>
                       </TouchableOpacity>
                    </>
                  )
               })()}
            </View>
          </View>

          {/* List */}
          <View style={{ flex: 1, padding: 15 }}>
            {(() => {
              // Filter completed
              let filtered = orders.filter(o => (o.status === 'delivered' || o.status === 'delivered_settled'));
              
              // Filter by sub tab
              if (completedSubTab === 'accounted') {
                filtered = filtered.filter(o => o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled')));
              } else {
                filtered = filtered.filter(o => !(o.paymentStatus === 'settled' || (o.status && o.status.endsWith('_settled'))));
              }

              // Filter by search
              if (completedSearchQuery.trim()) {
                const q = completedSearchQuery.toLowerCase();
                filtered = filtered.filter(o => 
                  (o.receiptNumber && String(o.receiptNumber).toLowerCase().includes(q)) ||
                  (o.customerName && String(o.customerName).toLowerCase().includes(q)) ||
                  (o.customerPhone && String(o.customerPhone).toLowerCase().includes(q))
                );
              }

              if (filtered.length === 0) {
                return (
                  <View style={{ marginTop: 50, alignItems: 'center' }}>
                     <Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>لا يوجد نتائج</Text>
                  </View>
                );
              }

              return (
                <>
                  <FlatList 
                      data={filtered} 
                      keyExtractor={item => item.id}
                      initialNumToRender={25}
                      maxToRenderPerBatch={50}
                      windowSize={10}
                      contentContainerStyle={{ paddingBottom: 50 }}
                      renderItem={({item, index}) => (
                    <View key={item.id} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' }}>
                       <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                         <Text style={{ fontWeight: 'bold', color: '#10b951' }}>رقم الوصل: {item.receiptNumber || item.id}</Text>
                         <Text style={{ color: '#666' }}>{translateStatus(item.status)}</Text>
                       </View>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الزبون: {item.customerName || '-'}</Text>
                       <Text style={{ textAlign: 'right', marginBottom: 5 }}>الهاتف: {item.customerPhone || '-'}</Text>
                       <Text style={{ textAlign: 'right', fontWeight: 'bold', color: '#333' }}>المبلغ: {item.totalAmount ? parseInt(item.totalAmount).toLocaleString('en-US') + ' د.ع' : '-'}</Text>
                    </View>
                  )} 
                  />
                </>
              );
            })()}
            <View style={{height: 50}} />
          </View>
        </View>
      )}

      {/* Bottom Tabs Navigation */}
      <View style={styles.bottomNav}>

        {/* Center-Right: طلبيات (orders) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'orders' && styles.navItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          {renderSearchIcon(activeTab === 'orders')}
          <Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>بحث</Text>
        </TouchableOpacity>

        {/* Center-Left: Floating + (entry) */}
        <View style={[styles.centerNavWrapper, { marginTop: -40, flex: 1.2 }]}>
          <TouchableOpacity 
            style={[styles.centerNavBtn, { backgroundColor: 'transparent', borderWidth: 0, width: 68, height: 68, shadowColor: 'transparent', elevation: 0 }, activeTab === 'entry' && styles.centerNavBtnActive]}
            onPress={() => setPlusMenuVisible(true)}
          >
            <Svg width="76" height="76" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Polygon points="50 5, 93 30, 93 70, 50 95, 7 70, 7 30" fill="#a855f7" stroke="#8b5cf6" strokeWidth="6" />
              <Polygon points="50 12, 85 32, 85 68, 50 88, 15 68, 15 32" fill="transparent" stroke="#d8b4fe" strokeWidth="3" />
            </Svg>
            <Text style={[styles.centerNavIcon, { zIndex: 2, fontSize: 34, color: 'white', marginTop: -4, fontWeight: '500' }]}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Left: المنتجات (settings) */}
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'products_manager' && styles.navItemActive]}
          onPress={() => setActiveTab('products_manager')}
        >
          {renderProductsIcon(activeTab === 'products_manager')}
          <Text style={[styles.navText, activeTab === 'products_manager' && styles.navTextActive]}>المنتجات</Text>
        </TouchableOpacity>
      </View>

      {/* --- Modals Section --- */}

      {/* Plus Menu Modal (Action Sheet) */}
      <Modal visible={plusMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setPlusMenuVisible(false)}>
          <View style={{ backgroundColor: isLightMode ? '#fff' : '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, alignItems: 'center' }}>
            <View style={{ width: 40, height: 5, backgroundColor: isLightMode ? '#cbd5e1' : '#475569', borderRadius: 5, marginBottom: 20 }} />
            
            <TouchableOpacity 
              style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155' }} 
              onPress={() => { 
                resetOrderForm(); 
                setPlusMenuVisible(false); 
                setActiveTab('entry'); 
              }}
            >
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>📦 إضافة طلب جديد</Text>
            </TouchableOpacity>

            {editingOrderId && (
              <TouchableOpacity 
                style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155', backgroundColor: isLightMode ? '#fef3c7' : 'rgba(234, 179, 8, 0.15)' }} 
                onPress={() => { 
                  setPlusMenuVisible(false); 
                  setActiveTab('entry'); 
                }}
              >
                <Text style={{ fontSize: 16, color: '#eab308', fontWeight: 'bold' }}>✏️ متابعة تعديل الطلب السابق (#{originalOrderDetails?.receiptNumber || editingOrderId.substring(0, 6)})</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155' }} onPress={() => { setPlusMenuVisible(false); setActiveTab('add_expense'); }}>
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>💸 إضافة مصروف</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15 }} onPress={() => { setPlusMenuVisible(false); setAddBarcodeModalVisible(true); }}>
              <Text style={{ fontSize: 18, color: isLightMode ? '#1e293b' : '#f8fafc', fontWeight: 'bold' }}>🧾 إضافة وصل باركود</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Expense Modal */}
      <Modal visible={addExpenseModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>إضافة مصروف جديد</Text>
            
            <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
              <Picker selectedValue={newExpenseCategory} onValueChange={setNewExpenseCategory} style={{ color: isLightMode ? '#000' : '#fff' }}>
                <Picker.Item label="-- الفئة --" value="" />
                {expenseCategoriesDb.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
              </Picker>
            </View>

            <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, marginBottom: 10 }}>
              <Picker selectedValue={newExpenseWallet} onValueChange={setNewExpenseWallet} style={{ color: isLightMode ? '#000' : '#fff' }}>
                <Picker.Item label="-- الخزنة (للسحب منها) --" value="" />
                {walletsDb.map(w => <Picker.Item key={w.id} label={w.name} value={w.id} />)}
              </Picker>
            </View>

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
              <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', flex: 1, marginLeft: 10, textAlign: 'right' }]} placeholder="المبلغ" placeholderTextColor="#64748b" keyboardType="numeric" value={newExpenseAmount} onChangeText={setNewExpenseAmount} />
              
              <View style={{ backgroundColor: isLightMode ? '#f1f5f9' : '#334155', borderRadius: 8, flex: 0.5, marginBottom: 10 }}>
                <Picker selectedValue={newExpenseCurrency} onValueChange={setNewExpenseCurrency} style={{ color: isLightMode ? '#000' : '#fff' }}>
                  <Picker.Item label="د.ع" value="IQD" />
                  <Picker.Item label="$" value="USD" />
                </Picker>
              </View>
            </View>

            <TextInput style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right', height: 80, textAlignVertical: 'top' }]} placeholder="التفاصيل / ملاحظات" placeholderTextColor="#64748b" multiline value={newExpenseDetails} onChangeText={setNewExpenseDetails} />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleSaveExpense}><Text style={styles.modalCloseText}>حفظ المصروف</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => setAddExpenseModalVisible(false)}><Text style={styles.modalCloseText}>إغلاق</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Barcode Receipt Modal */}
      <Modal visible={addBarcodeModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b', width: '90%', height: '80%' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#1e293b' : '#fff' }]}>مسح وصل الباركود 📸</Text>
            
            <View style={{ flex: 1, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              {!cameraPermission ? (
                 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                   <ActivityIndicator size="large" color="#a855f7" />
                 </View>
              ) : !cameraPermission.granted ? (
                 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                   <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 15 }}>نحتاج إلى صلاحية الكاميرا لمسح الباركود</Text>
                   <TouchableOpacity style={{ backgroundColor: '#a855f7', padding: 10, borderRadius: 8 }} onPress={requestCameraPermission}>
                     <Text style={{ color: '#fff', fontWeight: 'bold' }}>منح الصلاحية</Text>
                   </TouchableOpacity>
                 </View>
              ) : (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
              )}
            </View>

            <Text style={{ color: isLightMode ? '#475569' : '#cbd5e1', marginBottom: 5, textAlign: 'right', fontWeight: 'bold' }}>أو أدخل رقم الوصل يدوياً:</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155', color: isLightMode ? '#000' : '#fff', textAlign: 'right', fontSize: 18, marginBottom: 15 }]} 
              placeholder="رقم الوصل..." 
              placeholderTextColor="#64748b" 
              value={newBarcodeReceipt} 
              onChangeText={setNewBarcodeReceipt} 
            />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleSaveBarcodeReceipt}>
              <Text style={styles.modalCloseText}>متابعة وإضافة طلب ➡️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={() => { setAddBarcodeModalVisible(false); setScanned(false); }}>
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* 1. Employee Selection Modal */}
      <Modal visible={bookingEmpModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>اختر موظفة الرد (التي حجزت الطلب)</Text>
            <FlatList 
              data={employees}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => { setOrderBookingEmployeeId(item.id); setBookingEmpModalVisible(false); }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setBookingEmpModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={empModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>اختر اسمك (الموظف مُدخل الطلب)</Text>
            <FlatList 
              data={employees}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => selectEmployee(item)}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setEmpModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Governorate Selection Modal */}
      <Modal visible={govModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>اختر المحافظة</Text>
            <FlatList 
              data={governoratesList}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => {
                    setGovernorate(item);
                    setGovModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setGovModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. Product Selection Modal */}
      <Modal visible={prodModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContentBig}>
            <Text style={styles.modalTitle}>اختر منتجاً لإضافته</Text>
            
            <TextInput 
              style={styles.searchBar}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="🔍 ابحث باسم المنتج أو باركود..."
              placeholderTextColor="rgba(255,255,255,0.4)"
            />

            <FlatList 
              data={filteredProductsSearch}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const price = item.units?.[0]?.selling || 0;
                return (
                  <TouchableOpacity 
                    style={styles.productSearchItem}
                    onPress={() => addToCart(item)}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <Text style={styles.productPriceText}>{price.toLocaleString()} د.ع</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptySearchText}>لا توجد نتائج مطابقة لبحثك.</Text>
              }
            />
            
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => {
                setProductSearch('');
                setProdModalVisible(false);
              }}
            >
              <Text style={styles.modalCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notifications Center Modal */}
      <Modal
        visible={isNotificationsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsNotificationsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 12 }}>
          <View style={{ width: '100%', maxHeight: '90%', backgroundColor: isLightMode ? '#ffffff' : '#1e1e2d', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#2d2d42', elevation: 15, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12 }}>
            
            {/* Header */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#f1f5f9' : '#2d2d42', paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isLightMode ? '#f3e8ff' : '#2e2640', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                      مركز الإشعارات
                    </Text>
                    {unreadNotificationsCount > 0 && (
                      <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>
                          {unreadNotificationsCount} جديد
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: isLightMode ? '#64748b' : '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                    آخر التغييرات والطلبات في النظام
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => setIsNotificationsModalVisible(false)} 
                style={{ width: 34, height: 34, backgroundColor: isLightMode ? '#f1f5f9' : '#262638', borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Actions Row */}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              {/* Filter Tabs */}
              <View style={{ flexDirection: 'row-reverse', backgroundColor: isLightMode ? '#f1f5f9' : '#14141e', borderRadius: 12, padding: 3, flex: 1 }}>
                <TouchableOpacity 
                  onPress={() => setNotifFilterTab('all')}
                  style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 9, backgroundColor: notifFilterTab === 'all' ? '#8b5cf6' : 'transparent' }}
                >
                  <Text style={{ color: notifFilterTab === 'all' ? '#fff' : (isLightMode ? '#64748b' : '#94a3b8'), fontSize: 12, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                    الكل ({userVisibleNotifications.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setNotifFilterTab('orders')}
                  style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 9, backgroundColor: notifFilterTab === 'orders' ? '#8b5cf6' : 'transparent' }}
                >
                  <Text style={{ color: notifFilterTab === 'orders' ? '#fff' : (isLightMode ? '#64748b' : '#94a3b8'), fontSize: 12, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                    📦 طلبات
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setNotifFilterTab('status')}
                  style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 9, backgroundColor: notifFilterTab === 'status' ? '#8b5cf6' : 'transparent' }}
                >
                  <Text style={{ color: notifFilterTab === 'status' ? '#fff' : (isLightMode ? '#64748b' : '#94a3b8'), fontSize: 12, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                    🔄 تغيير حالات
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons: Mark all read & Clear */}
              <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                {unreadNotificationsCount > 0 && (
                  <TouchableOpacity 
                    onPress={markAllNotificationsAsRead}
                    style={{ paddingHorizontal: 10, paddingVertical: 7, backgroundColor: isLightMode ? '#ede9fe' : '#2c224d', borderRadius: 10, borderWidth: 1, borderColor: '#8b5cf6' }}
                  >
                    <Text style={{ color: '#8b5cf6', fontSize: 11, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                      ✓ قراءة الكل
                    </Text>
                  </TouchableOpacity>
                )}
                {userVisibleNotifications.length > 0 && (
                  <TouchableOpacity 
                    onPress={clearNotificationsForCurrentUser}
                    style={{ paddingHorizontal: 10, paddingVertical: 7, backgroundColor: isLightMode ? '#fee2e2' : '#3d1d24', borderRadius: 10, borderWidth: 1, borderColor: '#ef4444' }}
                  >
                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                      🗑️ مسح
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Notifications Stream */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              {(() => {
                const filtered = userVisibleNotifications.filter(n => {
                  if (notifFilterTab === 'orders') return n.type === 'order_created';
                  if (notifFilterTab === 'status') return n.type === 'status_changed';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                      <Text style={{ fontSize: 44, marginBottom: 12 }}>🔕</Text>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: isLightMode ? '#1e293b' : '#f8fafc', marginBottom: 6, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                        لا توجد إشعارات حتى الآن
                      </Text>
                      <Text style={{ fontSize: 13, color: isLightMode ? '#64748b' : '#94a3b8', textAlign: 'center', maxWidth: 260, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                        ستظهر هنا الإشعارات الفورية عند إنشاء أي طلب أو تغيير حالة طلب من الموظفين أو شركة الشحن.
                      </Text>
                    </View>
                  );
                }

                return filtered.map((item) => {
                  const readList = Array.isArray(item.readBy) ? item.readBy : [];
                  const isUnread = !readList.includes(user?.uid);
                  const isOrderCreated = item.type === 'order_created';

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      onPress={() => handleOpenNotificationItem(item)}
                      style={{
                        backgroundColor: isUnread 
                          ? (isLightMode ? '#f5f3ff' : '#27203b') 
                          : (isLightMode ? '#f8fafc' : '#171724'),
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: isUnread 
                          ? '#a855f7' 
                          : (isLightMode ? '#e2e8f0' : '#28283c'),
                        shadowColor: isUnread ? '#8b5cf6' : '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isUnread ? 0.15 : 0.05,
                        shadowRadius: 4,
                        elevation: isUnread ? 3 : 1,
                      }}
                    >
                      {/* Top Row: Icon + Title + Status + Dot */}
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={{ 
                            width: 32, 
                            height: 32, 
                            borderRadius: 16, 
                            backgroundColor: isOrderCreated ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: isOrderCreated ? '#10b981' : '#8b5cf6'
                          }}>
                            <Text style={{ fontSize: 16 }}>{isOrderCreated ? '📦' : '🔄'}</Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={{ 
                              fontSize: 14, 
                              fontWeight: 'bold', 
                              color: isLightMode ? '#0f172a' : '#f8fafc',
                              fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal'
                            }}>
                              {item.title}
                            </Text>
                            <Text style={{ fontSize: 11, color: isLightMode ? '#64748b' : '#94a3b8', marginTop: 1 }}>
                              {formatNotifTime(item.createdAt)}
                            </Text>
                          </View>
                        </View>

                        {isUnread && (
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
                            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>جديد</Text>
                          </View>
                        )}
                      </View>

                      {/* Transition info if status changed */}
                      {item.type === 'status_changed' && (item.oldStatus || item.newStatus) && (
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: isLightMode ? '#ede9fe' : '#1e1830', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginVertical: 6 }}>
                          <Text style={{ fontSize: 12, color: isLightMode ? '#475569' : '#cbd5e1' }}>
                            من: <Text style={{ fontWeight: 'bold' }}>{STATUS_LABELS_MAP[item.oldStatus] || translateStatus(item.oldStatus)}</Text>
                          </Text>
                          <Text style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 'bold' }}>➔</Text>
                          <Text style={{ fontSize: 12, color: '#10b981', fontWeight: 'bold' }}>
                            إلى: {STATUS_LABELS_MAP[item.newStatus] || translateStatus(item.newStatus)}
                          </Text>
                        </View>
                      )}

                      {/* Body Description */}
                      <Text style={{ 
                        fontSize: 12.5, 
                        color: isLightMode ? '#334155' : '#cbd5e1', 
                        lineHeight: 18, 
                        textAlign: 'right',
                        fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal'
                      }}>
                        {item.body}
                      </Text>

                      {/* Bottom Action Footer */}
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: isLightMode ? '#f1f5f9' : '#232336' }}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: 11, color: isLightMode ? '#64748b' : '#94a3b8' }}>بواسطة:</Text>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#8b5cf6' }}>{item.actorName || 'النظام'}</Text>
                        </View>

                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: 11, color: '#3b82f6', fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                            عرض الطلب 👁️
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full Order Details Modal */}
      <Modal visible={!!selectedOrderForDetails} transparent animationType="slide" onRequestClose={() => setSelectedOrderForDetails(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 12 }}>
          {selectedOrderForDetails && (
            <View style={{ width: '100%', maxHeight: '92%', backgroundColor: isLightMode ? '#ffffff' : '#1e293b', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 }}>
              
              {/* Header */}
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#f1f5f9' : '#334155', paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>📄</Text>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                    تفاصيل الطلب
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8b5cf6' }}>
                    #{selectedOrderForDetails.receiptNumber || selectedOrderForDetails.id?.substring(0, 8)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedOrderForDetails(null)} style={{ padding: 6, backgroundColor: isLightMode ? '#f1f5f9' : '#0f172a', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {/* Status Banner */}
                <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0f172a', padding: 12, borderRadius: 12, marginBottom: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                  <Text style={{ color: isLightMode ? '#64748b' : '#94a3b8', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>حالة الطلب الحالية:</Text>
                  <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#8b5cf6' }}>
                    <Text style={{ color: '#8b5cf6', fontWeight: 'bold', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                      {STATUS_LABELS_MAP[selectedOrderForDetails.status] || selectedOrderForDetails.status || 'غير محدد'}
                    </Text>
                  </View>
                </View>

                {/* Information Grid */}
                <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0f172a', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>مستخدم النظام</Text>
                      <Text style={{ color: isLightMode ? '#0f172a' : '#f8fafc', fontSize: 14, fontWeight: 'bold' }}>
                        {selectedOrderForDetails.customerName || selectedOrderForDetails.systemUser || '---'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>الموظف المسؤول</Text>
                      <Text style={{ color: isLightMode ? '#0f172a' : '#f8fafc', fontSize: 14, fontWeight: 'bold' }}>
                        {selectedOrderForDetails.bookingEmployeeName || selectedOrderForDetails.employeeName || '---'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>رقم الهاتف</Text>
                      <Text style={{ color: isLightMode ? '#0f172a' : '#f8fafc', fontSize: 14, fontWeight: 'bold' }}>
                        {selectedOrderForDetails.customerPhone || '---'}
                      </Text>
                      {selectedOrderForDetails.customerPhone2 ? (
                        <Text style={{ color: '#64748b', fontSize: 12 }}>{selectedOrderForDetails.customerPhone2}</Text>
                      ) : null}
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>المحافظة / المنطقة</Text>
                      <Text style={{ color: isLightMode ? '#0f172a' : '#f8fafc', fontSize: 14, fontWeight: 'bold' }}>
                        {selectedOrderForDetails.governorate || '---'} - {selectedOrderForDetails.region || selectedOrderForDetails.address || 'غير محدد'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>تاريخ وتوقيت الطلب</Text>
                      <Text style={{ color: isLightMode ? '#0f172a' : '#f8fafc', fontSize: 13, fontWeight: 'bold' }}>
                        {parseOrderDate(selectedOrderForDetails) ? parseOrderDate(selectedOrderForDetails).toLocaleString('en-GB') : '---'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 3 }}>طريقة الدفع</Text>
                      <Text style={{ color: isLightMode ? '#0f172a' : '#f8fafc', fontSize: 13, fontWeight: 'bold' }}>
                        {selectedOrderForDetails.paymentMethod || 'كاش عند التوصيل'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Items Table */}
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', textAlign: 'right', marginBottom: 8, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                  📦 المواد المطلوبة:
                </Text>
                <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', marginBottom: 16 }}>
                  {/* Table Header */}
                  <View style={{ flexDirection: 'row-reverse', backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 8 }}>
                    <Text style={{ flex: 0.6, color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>#</Text>
                    <Text style={{ flex: 2.5, color: '#fff', fontWeight: 'bold', textAlign: 'right', fontSize: 12 }}>الصنف</Text>
                    <Text style={{ flex: 1, color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>الكمية</Text>
                    <Text style={{ flex: 1.8, color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>السعر</Text>
                    <Text style={{ flex: 2, color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>الإجمالي</Text>
                  </View>

                  {/* Table Rows */}
                  {Array.isArray(selectedOrderForDetails.items) && selectedOrderForDetails.items.length > 0 ? (
                    selectedOrderForDetails.items.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row-reverse', backgroundColor: isLightMode ? (idx % 2 === 0 ? '#fff' : '#f8fafc') : (idx % 2 === 0 ? '#1e293b' : '#0f172a'), paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: isLightMode ? '#f1f5f9' : '#334155', alignItems: 'center' }}>
                        <Text style={{ flex: 0.6, color: isLightMode ? '#64748b' : '#94a3b8', textAlign: 'center', fontSize: 12 }}>{idx + 1}</Text>
                        <Text style={{ flex: 2.5, color: isLightMode ? '#0f172a' : '#f8fafc', textAlign: 'right', fontSize: 12, fontWeight: 'bold' }}>{item.productName || item.name || 'منتج'}</Text>
                        <Text style={{ flex: 1, color: isLightMode ? '#0f172a' : '#f8fafc', textAlign: 'center', fontSize: 13, fontWeight: 'bold' }}>{item.quantity || 1}</Text>
                        <Text style={{ flex: 1.8, color: isLightMode ? '#64748b' : '#94a3b8', textAlign: 'center', fontSize: 12 }}>{Number(item.unitPrice || 0).toLocaleString()} د.ع</Text>
                        <Text style={{ flex: 2, color: '#10b981', fontWeight: 'bold', textAlign: 'center', fontSize: 13 }}>{Number(item.total || ((item.unitPrice || 0) * (item.quantity || 1))).toLocaleString()} د.ع</Text>
                      </View>
                    ))
                  ) : (
                    <View style={{ padding: 15, backgroundColor: isLightMode ? '#fff' : '#1e293b', alignItems: 'center' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 13 }}>لا توجد منتجات مسجلة في هذا الطلب</Text>
                    </View>
                  )}
                </View>

                {/* Total & Notes */}
                <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0f172a', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: isLightMode ? '#e2e8f0' : '#334155', paddingBottom: 8 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 14 }}>المبلغ الكلي:</Text>
                    <Text style={{ color: '#10b981', fontSize: 15, fontWeight: 'bold' }}>
                      {Number(selectedOrderForDetails.totalAmount ?? selectedOrderForDetails.totalCost ?? 0).toLocaleString()} د.ع
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: isLightMode ? '#0f172a' : '#f8fafc', fontSize: 16, fontWeight: 'bold' }}>المبلغ الصافي:</Text>
                    <Text style={{ color: '#8b5cf6', fontSize: 18, fontWeight: 'bold' }}>
                      {Number(selectedOrderForDetails.totalAmount ?? selectedOrderForDetails.totalCost ?? 0).toLocaleString()} د.ع
                    </Text>
                  </View>
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginBottom: 2 }}>الملاحظات:</Text>
                    <Text style={{ color: isLightMode ? '#0f172a' : '#f8fafc', fontSize: 13, textAlign: 'right' }}>
                      {selectedOrderForDetails.notes || 'لا توجد ملاحظات'}
                    </Text>
                  </View>
                </View>

                {/* Activity Logs Timeline */}
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: isLightMode ? '#0f172a' : '#f8fafc', textAlign: 'right', marginBottom: 10, fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal' }}>
                  🕒 سجل عمليات الطلب:
                </Text>
                <View style={{ backgroundColor: isLightMode ? '#f8fafc' : '#0f172a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155', marginBottom: 16 }}>
                  {isLoadingOrderLogs ? (
                    <ActivityIndicator color="#8b5cf6" size="small" style={{ marginVertical: 10 }} />
                  ) : orderDetailsLogs.length > 0 ? (
                    orderDetailsLogs.map((log, index) => {
                      const isCreate = log.action && log.action.includes('إنشاء');
                      const isStatus = log.action && log.action.includes('حالة');
                      const badgeBg = isCreate ? 'rgba(14, 165, 233, 0.15)' : (isStatus ? 'rgba(217, 70, 239, 0.15)' : 'rgba(245, 158, 11, 0.15)');
                      const badgeColor = isCreate ? '#0284c7' : (isStatus ? '#c026d3' : '#d97706');
                      const dotColor = isCreate ? '#0284c7' : (isStatus ? '#c026d3' : '#f59e0b');
                      const dateObj = log.timestamp && typeof log.timestamp.toDate === 'function' 
                        ? log.timestamp.toDate() 
                        : (log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : new Date(log.timestamp || Date.now()));

                      return (
                        <View key={log.id || index} style={{ flexDirection: 'row-reverse', marginBottom: 14 }}>
                          <View style={{ alignItems: 'center', marginLeft: 10 }}>
                            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor, marginTop: 4 }} />
                            {index < orderDetailsLogs.length - 1 && (
                              <View style={{ width: 2, flex: 1, backgroundColor: isLightMode ? '#e2e8f0' : '#334155', marginVertical: 4 }} />
                            )}
                          </View>
                          <View style={{ flex: 1, backgroundColor: isLightMode ? '#fff' : '#1e293b', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: isLightMode ? '#e2e8f0' : '#334155' }}>
                            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                <Text style={{ color: badgeColor, fontSize: 12, fontWeight: 'bold' }}>{log.action || 'إجراء'}</Text>
                              </View>
                              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold' }}>👤 {log.employeeName || 'موظف'}</Text>
                              </View>
                            </View>
                            <Text style={{ color: isLightMode ? '#334155' : '#cbd5e1', fontSize: 13, textAlign: 'right', marginBottom: 4 }}>
                              {log.details || ''}
                            </Text>
                            <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'left' }}>
                              {dateObj ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' - ' + dateObj.toLocaleDateString('en-GB') : ''}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>لا توجد سجلات بعد لهذا الطلب</Text>
                  )}
                </View>

                {/* Modal Bottom Actions */}
                <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 4 }}>
                  {canChangeOrderStatus && (
                    <TouchableOpacity
                      onPress={() => {
                        const target = selectedOrderForDetails;
                        setSelectedOrderForDetails(null);
                        setTimeout(() => setStatusChangeModal({ visible: true, order: target }), 300);
                      }}
                      style={{ flex: 1, backgroundColor: '#8b5cf6', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>🔄 تعديل الحالة</Text>
                    </TouchableOpacity>
                  )}

                  {canChangeOrderStatus && (
                    <TouchableOpacity
                      onPress={() => {
                        const target = selectedOrderForDetails;
                        setSelectedOrderForDetails(null);
                        setSelectedGridStatus(null);
                        setIsSearchModalVisible(false);
                        setTimeout(() => handleEditOrder(target), 300);
                      }}
                      style={{ flex: 1, backgroundColor: '#eab308', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>✏️ تعديل الطلب</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => setSelectedOrderForDetails(null)}
                    style={{ flex: 0.8, backgroundColor: isLightMode ? '#f1f5f9' : '#334155', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: isLightMode ? '#0f172a' : '#fff', fontWeight: 'bold', fontSize: 14 }}>إغلاق</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Status Change Modal */}
      <Modal visible={statusChangeModal.visible} transparent animationType="slide" onRequestClose={() => setStatusChangeModal({ visible: false, order: null })}>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#fff' : '#1e293b', maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, { color: isLightMode ? '#0f172a' : '#fff', marginBottom: 4 }]}>
              🔄 تعديل حالة الطلب
            </Text>
            <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginBottom: 15 }}>
              رقم الوصل: {statusChangeModal.order?.receiptNumber || statusChangeModal.order?.id}
            </Text>
            
            <ScrollView style={{ width: '100%' }}>
              {[
                { id: 'pending', label: '🟡 قيد الانتظار', color: '#eab308', bg: '#fef9c3' },
                { id: 'backordered', label: '🟣 بانتظار المخزون', color: '#8b5cf6', bg: '#ede9fe' },
                { id: 'processing', label: '🔵 قيد المعالجة', color: '#2563eb', bg: '#dbeafe' },
                { id: 'shipped', label: '🚚 تم الشحن / مع المندوب', color: '#0284c7', bg: '#e0f2fe' },
                { id: 'delivered', label: '🟢 تم التسليم (واصل)', color: '#16a34a', bg: '#dcfce7' },
                { id: 'partial', label: '📦 واصل جزئي', color: '#0284c7', bg: '#e0f2fe' },
                { id: 'postponed', label: '🟠 مؤجل', color: '#ea580c', bg: '#ffedd5' },
                { id: 'returned', label: '🔴 راجع', color: '#dc2626', bg: '#fee2e2' },
                { id: 'returned_warehouse', label: '🏬 راجع مستلم بالمخزن', color: '#b91c1c', bg: '#fee2e2' },
                { id: 'cancelled', label: '⚫ ملغي', color: '#475569', bg: '#f1f5f9' },
              ].map(st => (
                <TouchableOpacity
                  key={st.id}
                  style={{
                    backgroundColor: st.bg,
                    borderColor: st.color,
                    borderWidth: 1.5,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    marginBottom: 10,
                    flexDirection: 'row-reverse',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onPress={() => applyStatusChange(st.id)}
                >
                  <Text style={{ color: st.color, fontWeight: 'bold', fontSize: 16 }}>{st.label}</Text>
                  {statusChangeModal.order?.status === st.id && (
                    <Text style={{ color: st.color, fontWeight: 'bold', fontSize: 15 }}>✓ الحالية</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { marginTop: 15 }]}
              onPress={() => setStatusChangeModal({ visible: false, order: null })}
            >
              <Text style={styles.modalCloseText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Order Confirmation Modal */}
      <Modal visible={deleteConfirmModal.visible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmModal({ visible: false, order: null })}>
        <View style={styles.alertBg}>
          <View style={[styles.alertContent, { maxWidth: 360 }]}>
            <Text style={{ fontSize: 34, textAlign: 'center', marginBottom: 10 }}>🗑️</Text>
            <Text style={[styles.alertMessage, { fontWeight: 'bold', fontSize: 18, marginBottom: 8, color: '#ef4444' }]}>
              تأكيد حذف الطلب
            </Text>
            <Text style={{ textAlign: 'center', color: isLightMode ? '#475569' : '#cbd5e1', fontSize: 14, marginBottom: 6 }}>
              هل أنت متأكد من رغبتك في حذف الطلب رقم:
            </Text>
            <Text style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, color: '#38bdf8', marginBottom: 15 }}>
              #{deleteConfirmModal.order?.receiptNumber || deleteConfirmModal.order?.id}
            </Text>
            <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 20 }}>
              سيتم حذف الطلب نهائياً وإعادة المواد المحجوزة للمخزن.
            </Text>

            <View style={{ flexDirection: 'row-reverse', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={[styles.alertBtn, { flex: 1, backgroundColor: '#ef4444' }]}
                onPress={executeDeleteOrder}
              >
                <Text style={styles.alertBtnText}>نعم، حذف الطلب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertBtn, { flex: 1, backgroundColor: isLightMode ? '#e2e8f0' : '#334155' }]}
                onPress={() => setDeleteConfirmModal({ visible: false, order: null })}
              >
                <Text style={[styles.alertBtnText, { color: isLightMode ? '#0f172a' : '#fff' }]}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. Global Alert Modal */}
      <Modal visible={alertModal.visible} transparent animationType="fade">
        <View style={styles.alertBg}>
          <View style={styles.alertContent}>
            <Text style={styles.alertMessage}>{alertModal.message}</Text>
            <TouchableOpacity 
              style={styles.alertBtn}
              onPress={() => setAlertModal({ visible: false, message: '' })}
            >
              <Text style={styles.alertBtnText}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    
      {showAdvSearchDateFromPicker && (
        <DateTimePicker
          value={advSearchDateFrom || new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowAdvSearchDateFromPicker(false);
            if (date) setAdvSearchDateFrom(date);
          }}
        />
      )}
      {showAdvSearchDateToPicker && (
        <DateTimePicker
          value={advSearchDateTo || new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowAdvSearchDateToPicker(false);
            if (date) setAdvSearchDateTo(date);
          }}
        />
      )}
      {showStartDatePicker && (
        <DateTimePicker
          value={tempCustomStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) setTempCustomStartDate(selectedDate);
          }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={tempCustomEndDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) setTempCustomEndDate(selectedDate);
          }}
        />
      )}
    
            {/* 5. Date Filter Modal */}
      <Modal visible={dateFilterModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تصفية التاريخ</Text>
            
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 15 }}>
              {[
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'today_and_yesterday', label: 'اليوم وأمس' },
                { id: 'last_7_days', label: 'آخر 7 أيام' },
                { id: 'last_30_days', label: 'آخر 30 يوم' },
                { id: 'last_60_days', label: 'آخر 60 يوم' },
                { id: 'last_90_days', label: 'آخر 90 يوم' },
                { id: 'year', label: 'سنة' },
                { id: 'all_time', label: 'فترة مطلقة' }
              ].map(filter => (
                <TouchableOpacity 
                  key={filter.id}
                  onPress={() => setTempGlobalDateFilter(filter.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: tempGlobalDateFilter === filter.id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 30, 40, 0.65)',
                    borderWidth: 1,
                    borderColor: tempGlobalDateFilter === filter.id ? '#a855f7' : '#475569',
                  }}
                >
                  <Text style={{ 
                    color: tempGlobalDateFilter === filter.id ? '#e9d5ff' : '#cbd5e1',
                    fontWeight: tempGlobalDateFilter === filter.id ? 'bold' : 'normal',
                    fontSize: 13
                  }}>{filter.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setTempGlobalDateFilter('custom')}>
              <Text style={{ color: tempGlobalDateFilter === 'custom' ? '#a855f7' : '#ffffff', marginBottom: 10, textAlign: 'right', fontWeight: 'bold' }}>تاريخ مخصص:</Text>
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, opacity: tempGlobalDateFilter === 'custom' ? 1 : 0.5 }}>
              <TouchableOpacity 
                style={{ flex: 1, marginLeft: 8, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                   setTempGlobalDateFilter('custom');
                   setShowStartDatePicker(true);
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>من تاريخ</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{formatDateLocal(tempCustomStartDate)}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ flex: 1, marginRight: 8, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                   setTempGlobalDateFilter('custom');
                   setShowEndDatePicker(true);
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>إلى تاريخ</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{formatDateLocal(tempCustomEndDate)}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setTempGlobalDateFilter('specific_month')}>
               <Text style={{ color: tempGlobalDateFilter === 'specific_month' ? '#a855f7' : '#ffffff', marginBottom: 10, textAlign: 'right', fontWeight: 'bold' }}>تحديد شهر وسنة:</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 25, opacity: tempGlobalDateFilter === 'specific_month' ? 1 : 0.5 }}>
              <View style={{ flex: 1, marginLeft: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterMonth(prev => prev === 11 ? 0 : prev + 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
                  <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{tempFilterMonth + 1}</Text>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterMonth(prev => prev === 0 ? 11 : prev - 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
              </View>
              
              <View style={{ flex: 1, marginRight: 8, backgroundColor: '#334155', borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterYear(prev => prev + 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>+</Text></TouchableOpacity>
                  <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{tempFilterYear}</Text>
                  <TouchableOpacity onPress={() => { setTempGlobalDateFilter('specific_month'); setTempFilterYear(prev => prev - 1); }} style={{ padding: 10 }}><Text style={{ color: '#a855f7', fontSize: 18, fontWeight: 'bold' }}>-</Text></TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
               <TouchableOpacity 
                 style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center', flex: 1, marginLeft: 5 }}
                 onPress={() => {
                   setGlobalDateFilter(tempGlobalDateFilter);
                   setCustomStartDate(tempCustomStartDate);
                   setCustomEndDate(tempCustomEndDate);
                   setFilterMonth(tempFilterMonth);
                   setFilterYear(tempFilterYear);
                   setDateFilterModalVisible(false);
                 }}
               >
                 <Text style={{ color: '#fff', fontWeight: 'bold' }}>موافق</Text>
               </TouchableOpacity>
               
               <TouchableOpacity 
                 style={{ backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center', flex: 1, marginRight: 5 }}
                 onPress={() => setDateFilterModalVisible(false)}
               >
                 <Text style={{ color: '#fff', fontWeight: 'bold' }}>إلغاء</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showStartDatePicker && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) setCustomStartDate(selectedDate);
          }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) setCustomEndDate(selectedDate);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (isLightMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: isLightMode ? '#f4f0fa' : '#0d0d12',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: isLightMode ? '#f4f0fa' : '#0d0d12',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  loadingText: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
    fontSize: 16,
  },
  header: {
    height: 60,
    backgroundColor: isLightMode ? '#fdfcff' : 'rgba(30, 30, 40, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  headerTitle: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  empBadgeBtn: {
    backgroundColor: isLightMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.3)',
    maxWidth: 160,
  },
  empBadgeText: {
    color: isLightMode ? '#7c3aed' : '#c4b5fd',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  tabContent: {
    flex: 1,
    backgroundColor: isLightMode ? '#f4f0fa' : '#0d0d12',
  },
  scrollPadding: {
    padding: 15,
    paddingBottom: 70,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: isLightMode ? '#0f172a' : '#ffffff',
    marginBottom: 10,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statsGridRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  newStatCard: {
    flex: 1,
    backgroundColor: isLightMode ? '#fdfcff' : 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    elevation: isLightMode ? 2 : 3,
    shadowColor: isLightMode ? 'rgba(0,0,0,0.06)' : '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isLightMode ? 0.08 : 0.2,
    shadowRadius: 5,
  },
  newStatLabel: {
    fontSize: 12,
    color: isLightMode ? '#475569' : '#94a3b8',
    marginBottom: 6,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  newStatContent: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
    flex: 1,
    textAlign: 'right',
  },
  newStatIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  newStatIcon: {
    fontSize: 16,
  },
  statCardBig: {
    backgroundColor: isLightMode ? '#fdfcff' : 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    padding: 18,
    marginBottom: 20,
    elevation: isLightMode ? 2 : 3,
    shadowColor: isLightMode ? 'rgba(0,0,0,0.06)' : '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isLightMode ? 0.08 : 0.2,
    shadowRadius: 5,
    alignItems: 'center',
  },
  gaugeCard: {
    backgroundColor: isLightMode ? '#fdfcff' : 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
    elevation: isLightMode ? 2 : 3,
    shadowColor: isLightMode ? 'rgba(0,0,0,0.06)' : '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isLightMode ? 0.08 : 0.2,
    shadowRadius: 5,
    alignItems: 'center',
    width: 280,
    alignSelf: 'center',
  },
  gaugeCardHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: isLightMode ? '#0f172a' : '#ffffff',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 245,
    height: 160,
  },
  gaugeSvg: {
    width: 245,
    height: 160,
  },
  gaugeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: isLightMode ? '#7c3aed' : '#c084fc',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  gaugeDescription: {
    fontSize: 12,
    color: isLightMode ? '#475569' : '#94a3b8',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: isLightMode ? '#475569' : '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statValueBig: {
    fontSize: 22,
    fontWeight: 'bold',
    color: isLightMode ? '#0f172a' : '#ffffff',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  bigCard: {
    backgroundColor: isLightMode ? '#fdfcff' : 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    padding: 18,
    shadowColor: isLightMode ? 'rgba(0,0,0,0.06)' : '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isLightMode ? 0.08 : 0.2,
    shadowRadius: 5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: isLightMode ? '#0f172a' : '#ffffff',
    marginBottom: 15,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  orderItem: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderLeft: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderCustName: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  orderMetaText: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  orderRight: {
    alignItems: 'flex-start',
    gap: 6,
  },
  orderAmountText: {
    color: isLightMode ? '#7c3aed' : '#c084fc',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 99,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  badgePending: {
    backgroundColor: isLightMode ? '#fef3c7' : 'rgba(251, 191, 36, 0.15)',
  },
  badgeDelivered: {
    backgroundColor: isLightMode ? '#d1fae5' : 'rgba(16, 185, 129, 0.15)',
  },
  badgePartial: {
    backgroundColor: isLightMode ? '#e0f2fe' : 'rgba(14, 165, 233, 0.15)',
  },
  badgeReturned: {
    backgroundColor: isLightMode ? '#ffe4e6' : 'rgba(244, 63, 94, 0.15)',
  },
  badgeCancelled: {
    backgroundColor: isLightMode ? '#ffe4e6' : 'rgba(244, 63, 94, 0.15)',
  },
  badgeBackordered: {
    backgroundColor: isLightMode ? '#ede9fe' : 'rgba(139, 92, 246, 0.15)',
  },
  emptyText: {
    color: isLightMode ? '#475569' : '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  formContainer: {
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: isLightMode ? '#6d28d9' : '#c4b5fd',
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  labelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 15,
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 14,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  inputError: {
    borderColor: '#f43f5e',
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  phoneDropdown: {
    backgroundColor: isLightMode ? '#ffffff' : '#1e1e28',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: isLightMode ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)',
    alignItems: 'flex-end',
  },
  dropdownItemTitle: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  dropdownItemSubtitle: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalTrigger: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerText: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  triggerPlaceholder: {
    color: isLightMode ? '#94a3b8' : 'rgba(255, 255, 255, 0.3)',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  triggerArrow: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 12,
  },
  cartSection: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(30, 30, 40, 0.3)',
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  cartHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: isLightMode ? '#6d28d9' : '#c4b5fd',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  addProdBtn: {
    backgroundColor: isLightMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.3)',
  },
  addProdBtnText: {
    color: isLightMode ? '#7c3aed' : '#c4b5fd',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  cartItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isLightMode ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.03)',
  },
  cartItemLeft: {
    alignItems: 'flex-end',
  },
  cartItemName: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  cartItemSub: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  cartPriceContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 5,
  },
  cartPriceInput: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 75,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  currencyLabel: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 11,
    marginRight: 4,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  multiplierLabel: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 12,
    marginRight: 6,
    fontWeight: 'bold',
  },
  cartQtyControls: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    backgroundColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cartQtyInput: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 13,
    width: 36,
    height: 26,
    textAlign: 'center',
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  removeBtn: {
    paddingHorizontal: 5,
    marginLeft: 5,
  },
  removeBtnText: {
    color: '#f43f5e',
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    marginTop: 5,
  },
  totalLabel: {
    color: isLightMode ? '#6d28d9' : '#e9d5ff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  totalValue: {
    color: isLightMode ? '#6d28d9' : '#e9d5ff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  totalInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  totalAmountInput: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    color: isLightMode ? '#6d28d9' : '#e9d5ff',
    fontSize: 15,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 100,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  totalCurrencyLabel: {
    color: isLightMode ? '#6d28d9' : '#e9d5ff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 6,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  emptyCartText: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  paymentSelector: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  paymentBtn: {
    flex: 1,
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  paymentBtnActive: {
    borderColor: '#8b5cf6',
    backgroundColor: isLightMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.15)',
  },
  paymentBtnText: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  paymentBtnTextActive: {
    color: isLightMode ? '#7c3aed' : '#c4b5fd',
  },
  replaceBtn: {
    backgroundColor: isLightMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.3)',
  },
  replaceBtnText: {
    color: isLightMode ? '#7c3aed' : '#c4b5fd',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  submitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 55,
    backgroundColor: isLightMode ? 'rgba(253, 252, 255, 0.98)' : 'rgba(20, 20, 30, 0.95)',
    borderTopWidth: 1,
    borderTopColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 5,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActive: {
    backgroundColor: isLightMode ? 'rgba(139, 92, 246, 0.08)' : 'rgba(168, 85, 247, 0.05)',
    borderRadius: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  navIcon: {
    fontSize: 20,
    color: isLightMode ? '#64748b' : '#94a3b8',
    marginBottom: 2,
  },
  navIconActive: {
    color: isLightMode ? '#7c3aed' : '#a855f7',
  },
  navText: {
    color: isLightMode ? '#64748b' : '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  navTextActive: {
    color: isLightMode ? '#7c3aed' : '#d8b4fe',
    fontWeight: 'bold',
    textShadowColor: isLightMode ? 'transparent' : 'rgba(168, 85, 247, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  centerNavWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -28,
  },
  centerNavBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: isLightMode ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
  },
  centerNavBtnActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#e9d5ff',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    elevation: 10,
  },
  centerNavIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabHeaderCard: {
    backgroundColor: isLightMode ? '#fdfcff' : 'rgba(30, 30, 40, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  tabHeaderTitle: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  profileLabel: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  profileValue: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  profileDescription: {
    color: isLightMode ? '#64748b' : '#64748b',
    fontSize: 12,
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  profileSwitchBtn: {
    backgroundColor: isLightMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignSelf: 'center',
  },
  profileSwitchBtnText: {
    color: isLightMode ? '#7c3aed' : '#c084fc',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  settingLabel: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  settingValue: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  ordersHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: isLightMode ? '#fdfcff' : 'rgba(30, 30, 40, 0.65)',
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: isLightMode ? 2 : 0,
    shadowColor: '#000',
    shadowOpacity: isLightMode ? 0.06 : 0,
    shadowRadius: 4,
  },
  headerIconText: {
    fontSize: 18,
    color: isLightMode ? '#7c3aed' : '#a855f7',
  },
  headerCenter: {
    alignItems: 'center',
  },
  ordersHeaderTitle: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  ordersHeaderDate: {
    color: isLightMode ? '#64748b' : '#64748b',
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  segmentedControl: {
    flexDirection: 'row-reverse',
    backgroundColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.05)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: isLightMode ? '#ffffff' : '#6366f1',
    elevation: isLightMode ? 2 : 0,
    shadowColor: '#000',
    shadowOpacity: isLightMode ? 0.08 : 0,
    shadowRadius: 4,
  },
  segmentBtnText: {
    color: isLightMode ? '#64748b' : '#64748b',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  segmentBtnTextActive: {
    color: isLightMode ? '#7c3aed' : '#ffffff',
    fontWeight: 'bold',
  },
  countersRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  counterCard: {
    flex: 1,
    backgroundColor: isLightMode ? '#fdfcff' : 'rgba(30, 30, 40, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    elevation: isLightMode ? 2 : 0,
    shadowColor: '#000',
    shadowOpacity: isLightMode ? 0.05 : 0,
    shadowRadius: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  counterNumber: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  counterLabel: {
    color: isLightMode ? '#475569' : '#64748b',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  sectionHeaderTitle: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: isLightMode ? '#fdfcff' : '#1e1e28',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalContentBig: {
    backgroundColor: isLightMode ? '#fdfcff' : '#1e1e28',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: '85%',
  },
  modalTitle: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: isLightMode ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  modalItemText: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  modalCloseBtn: {
    backgroundColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 15,
    alignItems: 'center',
  },
  modalCloseText: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  searchBar: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'transparent',
    borderRadius: 12,
    padding: 12,
    color: isLightMode ? '#0f172a' : '#ffffff',
    textAlign: 'right',
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  neonSearchShadowWrapper: {
    marginBottom: 20,
    marginHorizontal: 4,
    borderRadius: 12,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 8,
  },
  neonSearchContainer: {
    height: 42,
    borderRadius: 12,
    backgroundColor: isLightMode ? '#ffffff' : '#07070b',
    overflow: 'hidden',
  },
  neonSearchClip: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  neonSearchSpinBg: {
    position: 'absolute',
    width: 360,
    height: 360,
    left: '50%',
    top: '50%',
    marginLeft: -180,
    marginTop: -180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  neonSearchInner: {
    position: 'absolute',
    left: 1.5,
    top: 1.5,
    right: 1.5,
    bottom: 1.5,
    borderRadius: 10.5,
    backgroundColor: isLightMode ? '#ffffff' : '#0a0a12',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  neonSearchInput: {
    flex: 1,
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 13,
    textAlign: 'right',
    paddingHorizontal: 12,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
    height: '100%',
  },
  neonSearchBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: isLightMode ? 'rgba(139, 92, 246, 0.12)' : 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1.2,
    borderColor: isLightMode ? 'rgba(139, 92, 246, 0.4)' : 'rgba(168, 85, 247, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  neonCardShadow: {
    borderRadius: 16,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    elevation: 10,
  },
  neonCardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  neonCardSpinBg: {
    position: 'absolute',
    width: 600,
    height: 600,
    left: '50%',
    top: '50%',
    marginLeft: -300,
    marginTop: -300,
  },
  neonCardInner: {
    margin: 1.5,
    borderRadius: 14.5,
    backgroundColor: isLightMode ? '#fdfcff' : '#0e0e18',
    padding: 18,
  },
  productSearchItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: isLightMode ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
  },
  productPriceText: {
    color: isLightMode ? '#7c3aed' : '#a78bfa',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  emptySearchText: {
    color: isLightMode ? '#475569' : '#94a3b8',
    textAlign: 'center',
    paddingVertical: 40,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  alertBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  alertContent: {
    backgroundColor: isLightMode ? '#fdfcff' : '#1e1e28',
    borderWidth: 1,
    borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    gap: 15,
    elevation: 5,
  },
  alertMessage: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  alertBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  alertBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authContainer: {
    flex: 1,
    backgroundColor: isLightMode ? '#eaddf5' : '#121216',
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authTitle: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authSubtitle: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authCard: {
    backgroundColor: isLightMode ? '#fdfcff' : '#1e1e24',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: isLightMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isLightMode ? 0.1 : 0.4,
    shadowRadius: 32,
    elevation: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authInput: {
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 15,
    textAlign: 'right',
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#8b5cf6',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authSubmitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  authSubmitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authToggleBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  authToggleText: {
    color: '#8b5cf6',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authSeparatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  authSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
  },
  authSeparatorText: {
    color: isLightMode ? '#475569' : '#94a3b8',
    fontSize: 12,
    marginHorizontal: 10,
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  },
  authGoogleBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: isLightMode ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 2,
  },
  authGoogleBtnText: {
    color: isLightMode ? '#0f172a' : '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Cairo' : 'normal',
  }
});