const fs = require('fs');
let code = fs.readFileSync('App.js', 'utf8');

const targetUI = `                <View style={{ borderWidth: 1, borderColor: '#332b47', borderRadius: 12, padding: 15, marginBottom: 20, backgroundColor: '#181726' }}>
                  {/* Fake log entry since full logs aren't saved in DB yet */}
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                    <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#a855f7', marginTop: 5 }} />
                      <View style={{ width: 2, height: 50, backgroundColor: '#332b47' }} />
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>إنشاء الطلب</Text>
                      <Text style={{ color: '#64748b', fontSize: 13 }}>تم تسجيل الطلب في النظام</Text>
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 5 }}>
                        <Text style={{ color: '#10b981', fontSize: 11 }}>👤 {selectedOrderForDetails.bookingEmployeeName || 'المدير'}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                        {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Text>
                      <Text style={{ color: '#64748b', fontSize: 10 }}>
                        {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleDateString('en-GB') : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                    <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginTop: 5 }} />
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>الحالة الحالية</Text>
                      <Text style={{ color: '#64748b', fontSize: 13 }}>تم تحديث حالة الطلب إلى {translateStatus(selectedOrderForDetails.status)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>الآن</Text>
                    </View>
                  </View>
                </View>`;

const newUI = `                <View style={{ borderWidth: 1, borderColor: '#332b47', borderRadius: 12, padding: 15, marginBottom: 20, backgroundColor: '#181726' }}>
                  {/* Dynamic Logs Render */}
                  {(selectedOrderForDetails.logs || []).slice().reverse().map((log, index, arr) => (
                    <View key={index} style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: index === arr.length - 1 ? 0 : 15 }}>
                      <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: index === 0 ? '#10b981' : '#a855f7', marginTop: 5 }} />
                        {index !== arr.length - 1 && <View style={{ width: 2, height: 50, backgroundColor: '#332b47' }} />}
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>{log.action}</Text>
                        <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'right' }}>{log.message}</Text>
                        <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 5 }}>
                          <Text style={{ color: '#10b981', fontSize: 11 }}>👤 {log.by}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          {log.date ? new Date(log.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 10 }}>
                          {log.date ? new Date(log.date).toLocaleDateString('en-GB') : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                  
                  {/* Original Creation Log fallback if logs array is empty or missing */}
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', marginTop: (selectedOrderForDetails.logs && selectedOrderForDetails.logs.length > 0) ? 15 : 0 }}>
                    <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: (selectedOrderForDetails.logs && selectedOrderForDetails.logs.length > 0) ? '#a855f7' : '#10b981', marginTop: 5 }} />
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>إنشاء الطلب</Text>
                      <Text style={{ color: '#64748b', fontSize: 13 }}>تم تسجيل الطلب في النظام</Text>
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 5 }}>
                        <Text style={{ color: '#10b981', fontSize: 11 }}>👤 {selectedOrderForDetails.bookingEmployeeName || 'المدير'}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                        {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Text>
                      <Text style={{ color: '#64748b', fontSize: 10 }}>
                        {selectedOrderForDetails.date && typeof selectedOrderForDetails.date.toDate === 'function' ? selectedOrderForDetails.date.toDate().toLocaleDateString('en-GB') : ''}
                      </Text>
                    </View>
                  </View>
                </View>`;

if (code.includes(targetUI)) {
    code = code.replace(targetUI, newUI);
    fs.writeFileSync('App.js', code);
    console.log("Successfully injected the logs UI.");
} else {
    console.log("Target UI not found!");
}
