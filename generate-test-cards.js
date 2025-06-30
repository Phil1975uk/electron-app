const fs = require('fs');
const path = require('path');

// Test data for different card types
const testData = {
  feature: [
    { title: "Connected e-bike", description: "Stay connected with your e-bike through the Riese & Müller Connect app. Monitor battery status, track rides, and receive maintenance alerts.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Control Technology", description: "Advanced control technology ensures smooth power delivery and optimal performance. The intelligent system adapts to your riding style and terrain conditions.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Any route, any time", description: "Conquer any terrain with confidence. The Delite5's advanced suspension and powerful motor system handle hills, rough roads, and challenging conditions effortlessly.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/9b/5e/9b5ea5e6-1de5-42ff-b1e2-1a939cec4e18/my2025_delite5_pinion_hlf_jederzeit_1600x1067.jpg" },
    { title: "Worry-free riding", description: "Built for reliability and safety. Every component is engineered to the highest standards, ensuring years of trouble-free riding enjoyment.", imageUrl: "https://assets.r-m.de/cms/media/filer_public_thumbnails/filer_public/04/f4/04f4b1c6-863f-4df9-a4c3-45ecd25f8ea8/my2025_delite5_pinion_vollausgestattet_1600x1067.jpg__720x540_q90_crop_subsampling-2_upscale.jpg" },
    { title: "Cockpit with Comfort display", description: "Stay informed and in control with the intuitive Comfort display. All essential information is clearly visible and easily accessible while riding.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_delite5_pinion_hlf_modul-2.jpg" },
    { title: "Cockpit with Multi-adapter", description: "Customize your cockpit setup with the versatile Multi-adapter system. Mount your phone, GPS, or other accessories exactly where you need them.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Offroad kit", description: "Transform your Delite5 into an off-road adventure machine. The comprehensive offroad kit includes everything needed for challenging terrain.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/83_12_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Dual Battery System", description: "Extend your range with the optional dual battery system. Double your riding distance and never worry about running out of power.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Advanced Suspension", description: "Experience unmatched comfort with the advanced suspension system. Smooth out rough roads and maintain control in all conditions.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/4e/4e/4e4ec887-085a-4e4c-99a2-d969bbf3008e/my2025_delite5_pinion_hlf_maximal_1600x1067.jpg" },
    { title: "Smart Lighting System", description: "Illuminate your path with the intelligent lighting system. Automatic brightness adjustment and integrated turn signals for maximum safety.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Integrated Security", description: "Protect your investment with the integrated security system. GPS tracking and remote immobilization provide peace of mind.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Premium Comfort Seat", description: "Ride in luxury with the premium comfort seat. Ergonomic design and high-quality materials ensure all-day comfort.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Weather Protection Package", description: "Stay dry and comfortable in any weather. The comprehensive protection package includes mudguards, chain guard, and weather-resistant components.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/83_12_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Performance Tuning", description: "Unlock maximum performance with the advanced tuning system. Customize power delivery and response to match your riding preferences.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Integrated Cargo System", description: "Carry everything you need with the integrated cargo system. Modular design allows for maximum flexibility and capacity.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Premium Audio System", description: "Enjoy your favorite music while riding with the integrated premium audio system. Crystal clear sound and easy controls.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Advanced Navigation", description: "Never get lost with the advanced navigation system. Turn-by-turn directions and real-time traffic updates.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Performance Monitoring", description: "Track your performance with detailed analytics. Monitor speed, distance, power output, and efficiency metrics.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Smart Charging System", description: "Optimize charging with the intelligent charging system. Fast charging capabilities and battery health monitoring.", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Premium Finish Options", description: "Express your style with premium finish options. Multiple color choices and special edition designs available.", imageUrl: "https://assets.r-m.de/cms/media/filer_public/4e/4e/4e4ec887-085a-4e4c-99a2-d969bbf3008e/my2025_delite5_pinion_hlf_maximal_1600x1067.jpg" }
  ],
  option: [
    { title: "Dual Battery Upgrade", description: "Double your range with the dual battery system. Perfect for long-distance touring and extended adventures.", price: "€1,200", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Premium Comfort Seat", description: "Upgrade to the premium comfort seat for all-day riding comfort. Ergonomic design with memory foam padding.", price: "€350", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Advanced Lighting Package", description: "Enhanced visibility with the advanced lighting package. Includes high-power LED headlight and integrated turn signals.", price: "€280", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Security System", description: "Protect your investment with the integrated security system. GPS tracking and remote immobilization included.", price: "€450", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Performance Tuning Kit", description: "Unlock maximum performance with the advanced tuning kit. Customize power delivery and response characteristics.", price: "€180", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Premium Audio System", description: "Enjoy music while riding with the integrated premium audio system. Bluetooth connectivity and waterproof speakers.", price: "€320", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Navigation Package", description: "Advanced navigation with turn-by-turn directions and real-time traffic updates. Large color display included.", price: "€290", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Performance Monitor", description: "Track your performance with detailed analytics. Monitor speed, distance, power output, and efficiency.", price: "€150", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Smart Charging Station", description: "Fast charging station with battery health monitoring. Reduces charging time by up to 50%.", price: "€420", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Premium Paint Finish", description: "Express your style with premium paint finishes. Multiple color options and special edition designs.", price: "€280", imageUrl: "https://assets.r-m.de/cms/media/filer_public/4e/4e/4e4ec887-085a-4e4c-99a2-d969bbf3008e/my2025_delite5_pinion_hlf_maximal_1600x1067.jpg" },
    { title: "Extended Warranty", description: "Extend your warranty coverage to 5 years. Comprehensive protection for all major components.", price: "€380", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Service Package", description: "Pre-paid service package for 3 years. Includes annual maintenance and priority service scheduling.", price: "€520", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Training Wheels Kit", description: "Perfect for new riders. Easy-to-install training wheels with adjustable height settings.", price: "€95", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Child Seat Mount", description: "Safe and secure child seat mounting system. Compatible with most child seats on the market.", price: "€120", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Phone Mount", description: "Secure phone mounting system with charging capability. Perfect for navigation and music control.", price: "€85", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Bike Cover", description: "Premium bike cover for outdoor storage. Waterproof and UV-resistant material.", price: "€75", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Tool Kit", description: "Comprehensive tool kit for basic maintenance and repairs. Includes all essential tools and spare parts.", price: "€65", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "First Aid Kit", description: "Compact first aid kit designed for cyclists. Essential supplies for minor injuries and emergencies.", price: "€45", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Reflective Safety Kit", description: "Enhance visibility with the reflective safety kit. Includes reflective strips and safety lights.", price: "€35", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Bike Lock", description: "High-security bike lock with alarm system. Deter theft with loud alarm and robust construction.", price: "€110", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" }
  ],
  spec: [
    { title: "Technical Specifications", description: "Complete technical specifications for the Riese & Müller Delite5 including dimensions, weight, motor specifications, and performance data." },
    { title: "Motor Specifications", description: "Detailed motor specifications including power output, torque curves, efficiency ratings, and operating parameters." },
    { title: "Battery Specifications", description: "Comprehensive battery specifications including capacity, voltage, charging times, and cycle life information." },
    { title: "Frame Specifications", description: "Detailed frame specifications including materials, geometry, weight limits, and construction methods." },
    { title: "Wheel Specifications", description: "Complete wheel specifications including sizes, materials, spoke count, and compatibility information." },
    { title: "Brake Specifications", description: "Detailed brake specifications including type, power, modulation, and maintenance requirements." },
    { title: "Gear Specifications", description: "Comprehensive gear specifications including ratios, shift patterns, and compatibility with different systems." },
    { title: "Suspension Specifications", description: "Detailed suspension specifications including travel, damping, spring rates, and adjustment ranges." },
    { title: "Lighting Specifications", description: "Complete lighting specifications including power output, beam patterns, and electrical requirements." },
    { title: "Display Specifications", description: "Detailed display specifications including screen size, resolution, features, and connectivity options." },
    { title: "Connectivity Specifications", description: "Comprehensive connectivity specifications including Bluetooth, GPS, and app compatibility." },
    { title: "Weight Specifications", description: "Detailed weight specifications including frame weight, component weights, and total system weight." },
    { title: "Dimension Specifications", description: "Complete dimension specifications including wheelbase, head angle, seat angle, and clearance measurements." },
    { title: "Performance Specifications", description: "Detailed performance specifications including top speed, acceleration, range, and efficiency data." },
    { title: "Safety Specifications", description: "Comprehensive safety specifications including braking distances, stability ratings, and safety features." },
    { title: "Environmental Specifications", description: "Detailed environmental specifications including efficiency ratings, emissions, and sustainability features." },
    { title: "Maintenance Specifications", description: "Complete maintenance specifications including service intervals, lubrication requirements, and inspection procedures." },
    { title: "Warranty Specifications", description: "Detailed warranty specifications including coverage periods, terms, and exclusions." },
    { title: "Compliance Specifications", description: "Comprehensive compliance specifications including safety standards, certifications, and regulatory requirements." },
    { title: "Accessory Specifications", description: "Detailed accessory specifications including compatibility, mounting requirements, and installation procedures." }
  ],
  weather: [
    { title: "Full Fender Set", description: "Complete fender set for maximum weather protection. Includes front and rear mudguards with integrated lighting.", price: "€180", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/83_12_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Chain Guard", description: "Protect your drivetrain from dirt and moisture with the integrated chain guard. Easy maintenance and cleaning.", price: "€95", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Waterproof Bag", description: "Keep your belongings dry with the waterproof bag. Multiple sizes available for different storage needs.", price: "€120", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Rain Poncho", description: "Stay dry in any weather with the specially designed rain poncho. Breathable material with full coverage.", price: "€85", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Waterproof Gloves", description: "Maintain control in wet conditions with waterproof gloves. Grip-enhancing material with thermal insulation.", price: "€65", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Mud Flaps", description: "Additional mud protection with extended mud flaps. Easy to install and adjust for optimal coverage.", price: "€45", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Weatherproof Cover", description: "Protect your bike from the elements with the weatherproof cover. UV-resistant and breathable material.", price: "€75", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Waterproof Phone Case", description: "Keep your phone safe and accessible in any weather. Touchscreen compatible and fully waterproof.", price: "€35", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Wind Protection", description: "Reduce wind resistance and stay warm with the wind protection system. Adjustable coverage for different conditions.", price: "€110", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Thermal Insulation", description: "Stay warm in cold weather with the thermal insulation kit. Easy to install and remove as needed.", price: "€95", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Waterproof Boots", description: "Keep your feet dry with waterproof cycling boots. Comfortable fit with excellent grip and protection.", price: "€140", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Rain Hood", description: "Protect your head and face from rain with the adjustable rain hood. Compatible with all helmet types.", price: "€55", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Waterproof Socks", description: "Keep your feet dry and comfortable with waterproof cycling socks. Breathable material with moisture management.", price: "€25", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Weather Station", description: "Monitor weather conditions with the integrated weather station. Real-time data for informed riding decisions.", price: "€160", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Anti-Fog Treatment", description: "Prevent fogging on glasses and visors with the anti-fog treatment. Long-lasting protection for clear vision.", price: "€30", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Waterproof Backpack", description: "Carry your essentials safely with the waterproof backpack. Multiple compartments and comfortable fit.", price: "€90", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Weather Alert System", description: "Stay informed about weather changes with the weather alert system. Automatic notifications for severe weather.", price: "€70", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Waterproof Tool Kit", description: "Keep your tools dry and organized with the waterproof tool kit. Essential tools for roadside repairs.", price: "€80", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Weatherproof Lights", description: "Enhanced visibility in all weather conditions with weatherproof lights. Bright output with long battery life.", price: "€100", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" }
  ],
  cargo: [
    { title: "Front Cargo Basket", description: "Versatile front cargo basket for carrying groceries, bags, and other items. Easy to install and remove.", price: "€120", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Rear Cargo Rack", description: "Heavy-duty rear cargo rack with integrated lighting. Supports up to 25kg of cargo safely.", price: "€95", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Pannier Bags", description: "Waterproof pannier bags for side mounting. Multiple sizes available for different storage needs.", price: "€140", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Top Tube Bag", description: "Convenient top tube bag for easy access to essentials. Perfect for phones, keys, and small items.", price: "€45", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Handlebar Bag", description: "Easy-access handlebar bag with clear map pocket. Perfect for navigation and small essentials.", price: "€65", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Seat Bag", description: "Compact seat bag for tools and spare parts. Fits under the seat for easy access during rides.", price: "€35", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Cargo Trailer", description: "Heavy-duty cargo trailer for large loads. Perfect for shopping trips and transporting bulky items.", price: "€280", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Child Trailer", description: "Safe and comfortable child trailer for family rides. Includes safety harness and weather protection.", price: "€320", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Pet Carrier", description: "Secure pet carrier for transporting small animals. Ventilated design with safety features.", price: "€180", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Laptop Bag", description: "Padded laptop bag with waterproof protection. Perfect for commuting and business travel.", price: "€85", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Cooler Bag", description: "Insulated cooler bag for keeping food and drinks cold. Perfect for picnics and long rides.", price: "€75", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Tool Bag", description: "Organized tool bag with compartments for all essential tools. Easy to access during roadside repairs.", price: "€55", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Shopping Bag", description: "Collapsible shopping bag for grocery runs. Fits easily in panniers when not in use.", price: "€25", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Wine Bottle Holder", description: "Secure wine bottle holder for transporting bottles safely. Perfect for dinner parties and gifts.", price: "€40", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Flower Basket", description: "Decorative flower basket for carrying plants and flowers. Perfect for garden center visits.", price: "€60", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" },
    { title: "Bread Basket", description: "Traditional bread basket for carrying fresh bread and pastries. Lined with moisture-resistant material.", price: "€50", imageUrl: "https://assets.r-m.de/cms/media/filer_public/8d/1d/8d1d37f1-91bf-4c30-953d-597987e450df/my2025_rx-connect.jpg" },
    { title: "Mail Bag", description: "Secure mail bag for postal workers and delivery services. Lockable design with weather protection.", price: "€90", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_13_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Medical Bag", description: "Organized medical bag for first responders and healthcare workers. Multiple compartments for supplies.", price: "€110", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01316/85_7_detail.jpg.695x464_q80_upscale.jpg" },
    { title: "Camera Bag", description: "Padded camera bag for photographers. Protects equipment while providing easy access.", price: "€95", imageUrl: "https://assets.r-m.de/cms/media/filer_public/bf/63/bf633c47-a116-4ccc-8772-c42895fbcda7/my2025_pinion_hlf_modul-2.jpg" },
    { title: "Art Supply Bag", description: "Organized art supply bag for artists and students. Multiple compartments for different materials.", price: "€70", imageUrl: "https://assets.r-m.de/cms/media/bikes/F01315/83_11_detail.jpg" }
  ]
};

// Configuration data
const configurations = [
  { brand: "Riese & Müller", model: "Delite5", generation: "2025", variants: ["Pinion HLF", "Pinion C", "Rohloff E-14"] },
  { brand: "Riese & Müller", model: "Homage4", generation: "2025", variants: ["Dual Battery", "Single Battery"] },
  { brand: "Riese & Müller", model: "Packster", generation: "2025", variants: ["Packster 60", "Packster 70"] },
  { brand: "Riese & Müller", model: "Charger4", generation: "2025", variants: ["Mixte", "Diamond"] }
];

// Generate cards
function generateCards() {
  const cardsDir = path.join(__dirname, 'renderer', 'cards');
  
  // Ensure cards directory exists
  if (!fs.existsSync(cardsDir)) {
    fs.mkdirSync(cardsDir, { recursive: true });
  }

  let cardCount = 0;

  // Generate 20 cards of each type
  Object.keys(testData).forEach(cardType => {
    for (let i = 0; i < 20; i++) {
      const data = testData[cardType][i % testData[cardType].length]; // Cycle through available data
      const config = configurations[i % configurations.length];
      const timestamp = Date.now() + cardCount;
      
      const card = {
        id: timestamp.toString(),
        filename: `${cardType}_${config.brand.replace(/\s+/g, '_')}_${config.model}_${data.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}_${timestamp}.json`,
        title: data.title,
        description: data.description,
        cardType: cardType,
        configuration: config,
        imageUrl: data.imageUrl || null,
        price: data.price || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // For specification cards, add HTML content
      if (cardType === 'spec') {
        card.htmlContent = `<table class="specification-table">
          <thead>
            <tr><th>Specification</th><th>Value</th></tr>
          </thead>
          <tbody>
            <tr><td>Motor Power</td><td>250W - 500W</td></tr>
            <tr><td>Battery Capacity</td><td>500Wh - 1000Wh</td></tr>
            <tr><td>Range</td><td>80km - 150km</td></tr>
            <tr><td>Max Speed</td><td>25km/h (EU) / 45km/h (US)</td></tr>
            <tr><td>Weight</td><td>28kg - 35kg</td></tr>
            <tr><td>Frame Material</td><td>Aluminum / Carbon Fiber</td></tr>
            <tr><td>Brakes</td><td>Hydraulic Disc</td></tr>
            <tr><td>Gears</td><td>Pinion / Rohloff / Derailleur</td></tr>
          </tbody>
        </table>`;
      }

      const filepath = path.join(cardsDir, card.filename);
      fs.writeFileSync(filepath, JSON.stringify(card, null, 2));
      cardCount++;
      
      console.log(`Created: ${card.filename}`);
    }
  });

  console.log(`\nGenerated ${cardCount} test cards successfully!`);
}

// Run the generator
generateCards(); 