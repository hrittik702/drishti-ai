/**
 * Seed data for Edge-AI Training Centre Compliance Monitoring System
 * Represents training centres, active batches, attendance verification,
 * infrastructure checklists, edge device & CCTV telemetry, and compliance events.
 */

export const INITIAL_CENTRES = [
  {
    id: 'TC-DEL-0142',
    centreCode: 'TC-DEL-0142',
    name: 'Apex Horizon Skill Academy — Okhla Campus',
    scheme: 'PMKVY 4.0 (Electronics Sector Skill Council)',
    sector: 'Renewable Energy & Electronics',
    location: {
      state: 'Delhi',
      district: 'South Delhi',
      address: 'Plot 44-B, Okhla Industrial Area Phase-II, New Delhi - 110020'
    },
    assignedOfficer: 'Inspector Vikram Rathore',
    complianceStatus: 'ATTENTION',
    priority: 'High',
    createdAt: '2026-08-15T09:00:00.000Z',
    updatedAt: '2026-09-28T09:42:00.000Z',
    lastVerification: '2026-09-28T09:40:00.000Z',
    activeBatch: {
      batchId: 'BATCH-2026-SOLAR-01',
      courseName: 'Solar PV Panel Installation & Maintenance',
      enrolledCount: 30,
      startTime: '09:00',
      endTime: '17:00',
      classroom: 'Lab 2A (Renewable Energy Wing)',
      trainingHoursCompleted: 140,
      totalTrainingHours: 240
    },
    currentSession: {
      sessionId: 'SES-0142-99',
      topic: 'Inverter Wiring & Micro-Grid Synchronization',
      trainerName: 'Er. Sandeep Joshi (Certified Master Trainer)',
      trainerAadhaarLinked: true,
      trainerPresent: true,
      status: 'In Progress'
    },
    attendance: {
      declaredExpected: 28,
      detectedByAI: 22,
      difference: -6,
      discrepancyRate: 21.4,
      status: 'MISMATCH',
      lastChecked: '2026-09-28T09:40:00.000Z',
      confidence: 0.948
    },
    infrastructure: {
      totalRequired: 6,
      totalDetected: 5,
      status: 'DEFICIENT',
      items: [
        { name: 'Solar PV Array Simulator Bench', expected: 2, detected: 2, status: 'VERIFIED', category: 'Lab Equipment' },
        { name: 'Digital Interactive Smart Board', expected: 1, detected: 1, status: 'VERIFIED', category: 'Classroom Tech' },
        { name: 'Digital Multimeter & Toolkits', expected: 10, detected: 8, status: 'DEFICIENT', category: 'Consumables & Tools' },
        { name: 'Safety Harness & First Aid Station', expected: 1, detected: 1, status: 'VERIFIED', category: 'Safety & Compliance' },
        { name: 'Biometric Attendance Terminal (AEA)', expected: 1, detected: 1, status: 'VERIFIED', category: 'Statutory Hardware' },
        { name: 'CO2 Fire Extinguisher (5kg)', expected: 2, detected: 2, status: 'VERIFIED', category: 'Safety & Compliance' }
      ]
    },
    edgeHealth: {
      cameraCount: 4,
      camerasOnline: 3,
      camerasOffline: 1,
      edgeDeviceId: 'EDGE-JETSON-OKHLA-01',
      deviceModel: 'NVIDIA Jetson Orin Nano (8GB)',
      edgeStatus: 'ONLINE',
      fps: 18.4,
      latencyMs: 64,
      cpuUsage: 48,
      gpuUsage: 74,
      temperatureC: 56,
      aiModelVersion: 'YOLOv8-EduCompliance-v2.4',
      lastSync: '2026-09-28T09:41:20.000Z',
      cameras: [
        { id: 'CAM-01', name: 'Classroom Front View', status: 'ONLINE', resolution: '1080p', fps: 20 },
        { id: 'CAM-02', name: 'Classroom Rear Angle', status: 'ONLINE', resolution: '1080p', fps: 20 },
        { id: 'CAM-03', name: 'Practical Workbench Area', status: 'ONLINE', resolution: '1080p', fps: 18 },
        { id: 'CAM-04', name: 'Workshop Overhead', status: 'OFFLINE', resolution: '1080p', fps: 0, reason: 'RTSP stream timed out' }
      ]
    },
    recentAlertsCount: 2
  },
  {
    id: 'TC-BLR-0189',
    centreCode: 'TC-BLR-0189',
    name: 'Karnataka Technical Training Centre — Electronic City',
    scheme: 'DDU-GKY (Telecom Sector Skill Council)',
    sector: 'Telecom & Networking',
    location: {
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      address: 'Tower C, Electronic City Phase-I, Bengaluru - 560100'
    },
    assignedOfficer: 'Inspector Vikram Rathore',
    complianceStatus: 'CRITICAL',
    priority: 'Critical',
    createdAt: '2026-07-10T08:30:00.000Z',
    updatedAt: '2026-09-28T09:30:00.000Z',
    lastVerification: '2026-09-28T09:28:00.000Z',
    activeBatch: {
      batchId: 'BATCH-2026-TEL-03',
      courseName: '5G Optical Fiber Splicing & Testing Specialist',
      enrolledCount: 25,
      startTime: '10:00',
      endTime: '18:00',
      classroom: 'Fiber Optics Lab B',
      trainingHoursCompleted: 180,
      totalTrainingHours: 200
    },
    currentSession: {
      sessionId: 'SES-0189-42',
      topic: 'Fusion Splicing Calibration & OTDR Curve Analysis',
      trainerName: 'Ms. Pooja Hegde (Lead Technical Instructor)',
      trainerAadhaarLinked: true,
      trainerPresent: true,
      status: 'In Progress'
    },
    attendance: {
      declaredExpected: 24,
      detectedByAI: 15,
      difference: -9,
      discrepancyRate: 37.5,
      status: 'MISMATCH',
      lastChecked: '2026-09-28T09:28:00.000Z',
      confidence: 0.962
    },
    infrastructure: {
      totalRequired: 5,
      totalDetected: 3,
      status: 'DEFICIENT',
      items: [
        { name: 'Core Alignment Fusion Splicer', expected: 3, detected: 1, status: 'DEFICIENT', category: 'Lab Equipment' },
        { name: 'Optical Time-Domain Reflectometer (OTDR)', expected: 2, detected: 2, status: 'VERIFIED', category: 'Lab Equipment' },
        { name: 'Precision Fiber Cleaver Workstations', expected: 4, detected: 4, status: 'VERIFIED', category: 'Tools & Workstations' },
        { name: 'Chemical Safety & Emergency Eyewash Station', expected: 1, detected: 0, status: 'MISSING', category: 'Safety & Compliance' },
        { name: 'Static Dissipative ESD Mats (Workbenches)', expected: 12, detected: 12, status: 'VERIFIED', category: 'Classroom Tech' }
      ]
    },
    edgeHealth: {
      cameraCount: 3,
      camerasOnline: 3,
      camerasOffline: 0,
      edgeDeviceId: 'EDGE-JETSON-BLR-02',
      deviceModel: 'NVIDIA Jetson AGX Orin Industrial (32GB)',
      edgeStatus: 'DEGRADED',
      fps: 11.2,
      latencyMs: 142,
      cpuUsage: 82,
      gpuUsage: 91,
      temperatureC: 68,
      aiModelVersion: 'YOLOv8-EduCompliance-v2.4',
      lastSync: '2026-09-28T09:29:45.000Z',
      cameras: [
        { id: 'CAM-01', name: 'Classroom Overview', status: 'ONLINE', resolution: '1080p', fps: 15 },
        { id: 'CAM-02', name: 'Optical Workstations Cam', status: 'ONLINE', resolution: '1080p', fps: 12 },
        { id: 'CAM-03', name: 'Testing Lab Cam', status: 'ONLINE', resolution: '1080p', fps: 12 }
      ]
    },
    recentAlertsCount: 3
  },
  {
    id: 'TC-MUM-0077',
    centreCode: 'TC-MUM-0077',
    name: 'Maharashtra Vocational Excellence Hub — Andheri',
    scheme: 'PMKVY 4.0 (Automotive Skills Development Council)',
    sector: 'Automotive & Clean Mobility',
    location: {
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      address: 'Central Road, MIDC Industrial Area, Andheri East, Mumbai - 400093'
    },
    assignedOfficer: 'Inspector Vikram Rathore',
    complianceStatus: 'COMPLIANT',
    priority: 'Medium',
    createdAt: '2026-06-20T11:00:00.000Z',
    updatedAt: '2026-09-28T09:44:00.000Z',
    lastVerification: '2026-09-28T09:44:00.000Z',
    activeBatch: {
      batchId: 'BATCH-2026-EV-02',
      courseName: 'Electric Vehicle Powertrain Assembly & Diagnostics',
      enrolledCount: 20,
      startTime: '08:30',
      endTime: '16:30',
      classroom: 'Workshop A (EV Propulsion Unit)',
      trainingHoursCompleted: 210,
      totalTrainingHours: 300
    },
    currentSession: {
      sessionId: 'SES-0077-18',
      topic: 'Battery Management System (BMS) Calibration',
      trainerName: 'Dr. K. V. Salunkhe (Automotive Specialist)',
      trainerAadhaarLinked: true,
      trainerPresent: true,
      status: 'In Progress'
    },
    attendance: {
      declaredExpected: 20,
      detectedByAI: 20,
      difference: 0,
      discrepancyRate: 0.0,
      status: 'VERIFIED',
      lastChecked: '2026-09-28T09:44:00.000Z',
      confidence: 0.985
    },
    infrastructure: {
      totalRequired: 5,
      totalDetected: 5,
      status: 'ADEQUATE',
      items: [
        { name: 'EV Chassis & Powertrain Test Rig', expected: 1, detected: 1, status: 'VERIFIED', category: 'Lab Equipment' },
        { name: 'High-Voltage Battery Safety Enclosure', expected: 1, detected: 1, status: 'VERIFIED', category: 'Safety & Compliance' },
        { name: 'Insulated High-Voltage Hand Tool Sets', expected: 6, detected: 6, status: 'VERIFIED', category: 'Tools & Workstations' },
        { name: 'Automotive CAN-Bus Diagnostic Scanner', expected: 2, detected: 2, status: 'VERIFIED', category: 'Classroom Tech' },
        { name: 'Class D Battery Fire Suppression System', expected: 1, detected: 1, status: 'VERIFIED', category: 'Safety & Compliance' }
      ]
    },
    edgeHealth: {
      cameraCount: 5,
      camerasOnline: 5,
      camerasOffline: 0,
      edgeDeviceId: 'EDGE-JETSON-MUM-01',
      deviceModel: 'NVIDIA Jetson Orin Nano (8GB)',
      edgeStatus: 'ONLINE',
      fps: 24.0,
      latencyMs: 38,
      cpuUsage: 36,
      gpuUsage: 58,
      temperatureC: 49,
      aiModelVersion: 'YOLOv8-EduCompliance-v2.4',
      lastSync: '2026-09-28T09:44:10.000Z',
      cameras: [
        { id: 'CAM-01', name: 'Assembly Bay 1', status: 'ONLINE', resolution: '1080p', fps: 24 },
        { id: 'CAM-02', name: 'Assembly Bay 2', status: 'ONLINE', resolution: '1080p', fps: 24 },
        { id: 'CAM-03', name: 'Battery Testing Enclosure', status: 'ONLINE', resolution: '1080p', fps: 24 },
        { id: 'CAM-04', name: 'Lecture Hall Front', status: 'ONLINE', resolution: '1080p', fps: 24 },
        { id: 'CAM-05', name: 'Main Entry / Biometrics', status: 'ONLINE', resolution: '1080p', fps: 24 }
      ]
    },
    recentAlertsCount: 0
  },
  {
    id: 'TC-HYD-0254',
    centreCode: 'TC-HYD-0254',
    name: 'Telangana Advanced Robotics & Mechatronics Hub',
    scheme: 'National Apprenticeship Promotion Scheme (NAPS)',
    sector: 'Mechatronics & Industry 4.0',
    location: {
      state: 'Telangana',
      district: 'Hyderabad',
      address: 'Mechatronics Park, HITEC City, Madhapur, Hyderabad - 500081'
    },
    assignedOfficer: 'Inspector Vikram Rathore',
    complianceStatus: 'COMPLIANT',
    priority: 'Low',
    createdAt: '2026-05-18T10:00:00.000Z',
    updatedAt: '2026-09-28T09:41:00.000Z',
    lastVerification: '2026-09-28T09:41:00.000Z',
    activeBatch: {
      batchId: 'BATCH-2026-ROB-01',
      courseName: 'Industrial Collaborative Robotics Programmer',
      enrolledCount: 18,
      startTime: '09:00',
      endTime: '17:00',
      classroom: 'Robotics Automation Bay',
      trainingHoursCompleted: 260,
      totalTrainingHours: 320
    },
    currentSession: {
      sessionId: 'SES-0254-12',
      topic: 'Cobot Pick-and-Place Safety Perimeter Programming',
      trainerName: 'Dr. Anand Ramalingam (Robotics Engineer)',
      trainerAadhaarLinked: true,
      trainerPresent: true,
      status: 'In Progress'
    },
    attendance: {
      declaredExpected: 18,
      detectedByAI: 18,
      difference: 0,
      discrepancyRate: 0.0,
      status: 'VERIFIED',
      lastChecked: '2026-09-28T09:41:00.000Z',
      confidence: 0.991
    },
    infrastructure: {
      totalRequired: 6,
      totalDetected: 6,
      status: 'ADEQUATE',
      items: [
        { name: '6-Axis Articulated Robot Arm', expected: 2, detected: 2, status: 'VERIFIED', category: 'Lab Equipment' },
        { name: 'PLC Industrial Automation Racks', expected: 4, detected: 4, status: 'VERIFIED', category: 'Lab Equipment' },
        { name: 'Light Curtain & Safety E-Stop System', expected: 2, detected: 2, status: 'VERIFIED', category: 'Safety & Compliance' },
        { name: 'CAD/CAM Simulation Terminals', expected: 18, detected: 18, status: 'VERIFIED', category: 'Classroom Tech' },
        { name: 'First Aid & Burn Treatment Kit', expected: 1, detected: 1, status: 'VERIFIED', category: 'Safety & Compliance' },
        { name: 'Biometric Iris / Face Authentication Terminal', expected: 1, detected: 1, status: 'VERIFIED', category: 'Statutory Hardware' }
      ]
    },
    edgeHealth: {
      cameraCount: 4,
      camerasOnline: 4,
      camerasOffline: 0,
      edgeDeviceId: 'EDGE-JETSON-HYD-01',
      deviceModel: 'NVIDIA Jetson AGX Orin (64GB)',
      edgeStatus: 'ONLINE',
      fps: 28.5,
      latencyMs: 29,
      cpuUsage: 31,
      gpuUsage: 52,
      temperatureC: 45,
      aiModelVersion: 'YOLOv8-EduCompliance-v2.4',
      lastSync: '2026-09-28T09:41:35.000Z',
      cameras: [
        { id: 'CAM-01', name: 'Robotics Bay Cam 1', status: 'ONLINE', resolution: '1080p', fps: 30 },
        { id: 'CAM-02', name: 'Robotics Bay Cam 2', status: 'ONLINE', resolution: '1080p', fps: 30 },
        { id: 'CAM-03', name: 'PLC Testing Station', status: 'ONLINE', resolution: '1080p', fps: 28 },
        { id: 'CAM-04', name: 'Student Theory Lab', status: 'ONLINE', resolution: '1080p', fps: 28 }
      ]
    },
    recentAlertsCount: 0
  },
  {
    id: 'TC-JAI-0310',
    centreCode: 'TC-JAI-0310',
    name: 'Rajasthan Rural Empowerment Centre — Sitapura',
    scheme: 'DDU-GKY / Rajasthan Skill & Livelihoods Mission',
    sector: 'Apparel & Textile Manufacturing',
    location: {
      state: 'Rajasthan',
      district: 'Jaipur',
      address: 'Industrial Plot 12, RIICO Sitapura Phase-III, Jaipur - 302022'
    },
    assignedOfficer: 'Sub-Inspector Rajesh Verma',
    complianceStatus: 'OFFLINE',
    priority: 'Critical',
    createdAt: '2026-04-12T09:00:00.000Z',
    updatedAt: '2026-09-28T05:30:00.000Z',
    lastVerification: '2026-09-28T05:30:00.000Z',
    activeBatch: {
      batchId: 'BATCH-2026-TEX-05',
      courseName: 'Automated Industrial Sewing Machine Technician',
      enrolledCount: 22,
      startTime: '09:30',
      endTime: '17:30',
      classroom: 'Apparel Stitching Workshop',
      trainingHoursCompleted: 95,
      totalTrainingHours: 180
    },
    currentSession: {
      sessionId: 'SES-0310-09',
      topic: 'Overlock Tension Balancing & Needle Guard Setup',
      trainerName: 'Sh. Bheru Lal Saini',
      trainerAadhaarLinked: true,
      trainerPresent: false,
      status: 'Interrupted'
    },
    attendance: {
      declaredExpected: 22,
      detectedByAI: 0,
      difference: -22,
      discrepancyRate: 100.0,
      status: 'MISMATCH',
      lastChecked: '2026-09-28T05:30:00.000Z',
      confidence: 0.0
    },
    infrastructure: {
      totalRequired: 4,
      totalDetected: 0,
      status: 'DEFICIENT',
      items: [
        { name: 'Industrial Direct Drive Sewing Machines', expected: 20, detected: 0, status: 'MISSING', category: 'Lab Equipment' },
        { name: 'Fabric Cutting & Spreading Table', expected: 2, detected: 0, status: 'MISSING', category: 'Tools & Workstations' },
        { name: 'Needle Detector Machine', expected: 1, detected: 0, status: 'MISSING', category: 'Safety & Compliance' },
        { name: 'Biometric Attendance Device', expected: 1, detected: 0, status: 'MISSING', category: 'Statutory Hardware' }
      ]
    },
    edgeHealth: {
      cameraCount: 3,
      camerasOnline: 0,
      camerasOffline: 3,
      edgeDeviceId: 'EDGE-JETSON-JAI-01',
      deviceModel: 'NVIDIA Jetson Nano 4GB',
      edgeStatus: 'OFFLINE',
      fps: 0,
      latencyMs: 0,
      cpuUsage: 0,
      gpuUsage: 0,
      temperatureC: 0,
      aiModelVersion: 'YOLOv8-EduCompliance-v2.4',
      lastSync: '2026-09-28T05:30:14.000Z',
      cameras: [
        { id: 'CAM-01', name: 'Main Workshop Front', status: 'OFFLINE', resolution: '1080p', fps: 0, reason: 'Device unreachable' },
        { id: 'CAM-02', name: 'Stitching Row Left', status: 'OFFLINE', resolution: '1080p', fps: 0, reason: 'Device unreachable' },
        { id: 'CAM-03', name: 'Stitching Row Right', status: 'OFFLINE', resolution: '1080p', fps: 0, reason: 'Device unreachable' }
      ]
    },
    recentAlertsCount: 1
  }
];

export const INITIAL_COMPLIANCE_EVENTS = [
  {
    id: 'EVT-2026-0914',
    centreId: 'TC-BLR-0189',
    centreCode: 'TC-BLR-0189',
    centreName: 'Karnataka Technical Training Centre — Electronic City',
    eventType: 'Attendance Mismatch',
    timestamp: '2026-09-28T09:28:00.000Z',
    severity: 'Critical',
    status: 'OPEN',
    expectedValue: '24 Candidates Declared (Biometric/Portal)',
    detectedValue: '15 Candidates Detected by Edge AI',
    discrepancy: '-9 Candidates (-37.5% Deficit)',
    confidence: 0.962,
    cameraId: 'CAM-01-CLASSROOM',
    evidenceId: 'EVID-0189-ATT-01',
    details: 'Automated 15-minute verification sweep detected 15 active learners in seats versus 24 reported by centre biometric gateway. Discrepancy threshold exceeded (> 10%).'
  },
  {
    id: 'EVT-2026-0812',
    centreId: 'TC-DEL-0142',
    centreCode: 'TC-DEL-0142',
    centreName: 'Apex Horizon Skill Academy — Okhla Campus',
    eventType: 'Attendance Mismatch',
    timestamp: '2026-09-28T09:40:00.000Z',
    severity: 'High',
    status: 'OPEN',
    expectedValue: '28 Candidates Declared',
    detectedValue: '22 Candidates Detected by Edge AI',
    discrepancy: '-6 Candidates (-21.4% Deficit)',
    confidence: 0.948,
    cameraId: 'CAM-01',
    evidenceId: 'EVID-0142-ATT-01',
    details: 'CCTV edge analysis verified 22 persons present in Solar PV lab. 6 declared candidates unaccounted for in continuous 30-minute detection window.'
  },
  {
    id: 'EVT-2026-0771',
    centreId: 'TC-BLR-0189',
    centreCode: 'TC-BLR-0189',
    centreName: 'Karnataka Technical Training Centre — Electronic City',
    eventType: 'Missing Equipment',
    timestamp: '2026-09-28T09:15:00.000Z',
    severity: 'High',
    status: 'OPEN',
    expectedValue: '1 Emergency Chemical Eye Wash Unit',
    detectedValue: '0 Detected (Installation Area Empty)',
    discrepancy: 'Mandatory Safety Unit Not Found',
    confidence: 0.934,
    cameraId: 'CAM-03',
    evidenceId: 'EVID-0189-INF-01',
    details: 'Object detection scan for mandatory Sector Safety Kit failed to locate Chemical Eye Wash unit at designated coordinates.'
  },
  {
    id: 'EVT-2026-0655',
    centreId: 'TC-DEL-0142',
    centreCode: 'TC-DEL-0142',
    centreName: 'Apex Horizon Skill Academy — Okhla Campus',
    eventType: 'Camera Offline',
    timestamp: '2026-09-28T08:55:00.000Z',
    severity: 'Medium',
    status: 'OPEN',
    expectedValue: 'RTSP Stream 1080p @ 20fps',
    detectedValue: '0 fps / Connection Refused',
    discrepancy: 'CAM-04 Workshop Overhead Offline',
    confidence: 1.0,
    cameraId: 'CAM-04',
    evidenceId: 'EVID-0142-CAM-01',
    details: 'RTSP video stream for Camera 04 timed out after 3 reconnection attempts. Edge device reports network interface packet loss.'
  },
  {
    id: 'EVT-2026-0410',
    centreId: 'TC-JAI-0310',
    centreCode: 'TC-JAI-0310',
    centreName: 'Rajasthan Rural Empowerment Centre — Sitapura',
    eventType: 'Edge Device Offline',
    timestamp: '2026-09-28T05:30:14.000Z',
    severity: 'Critical',
    status: 'OPEN',
    expectedValue: 'Heartbeat ping every 60s',
    detectedValue: 'Last heartbeat received 254 minutes ago',
    discrepancy: 'Centre telemetry disconnected',
    confidence: 1.0,
    cameraId: 'N/A',
    evidenceId: 'EVID-0310-HRT-01',
    details: 'Edge Jetson device EDGE-JETSON-JAI-01 has ceased transmitting telemetry and heartbeat beacons. Inspection protocol initiated.'
  },
  {
    id: 'EVT-2026-0299',
    centreId: 'TC-MUM-0077',
    centreCode: 'TC-MUM-0077',
    centreName: 'Maharashtra Vocational Excellence Hub — Andheri',
    eventType: 'Periodic Verification Completed',
    timestamp: '2026-09-28T09:44:00.000Z',
    severity: 'Low',
    status: 'RESOLVED',
    expectedValue: '20 Candidates, 5 Equipment Items',
    detectedValue: '20 Candidates, 5 Equipment Items',
    discrepancy: '0.0% — Full Compliance Congruence',
    confidence: 0.985,
    cameraId: 'CAM-01',
    evidenceId: 'EVID-0077-SWEEP-01',
    details: 'Automated hourly compliance evaluation concluded with 100% attendance congruence and all safety benchmarks verified.'
  }
];

export const INITIAL_EVIDENCE = [
  {
    id: 'EVID-0142-ATT-01',
    eventId: 'EVT-2026-0812',
    centreId: 'TC-DEL-0142',
    centreName: 'Apex Horizon Skill Academy — Okhla Campus',
    title: 'CAM-01 Classroom Front View — Candidate Count Verification Frame',
    captureTimestamp: '2026-09-28T09:40:00.000Z',
    cctvCameraId: 'CAM-01-CLASSROOM',
    mediaType: 'IMAGE',
    sha256: '9f83a48e718b2a3b098234857a26f8d3885c301c20e176b6f00122e20b3294aa',
    resolution: '1920x1080',
    fps: 20.0,
    expectedCount: 28,
    detectedCount: 22,
    difference: -6,
    confidence: 0.948,
    inferenceTimeMs: 44.2,
    aiModel: 'YOLOv8-EduCompliance-v2.4',
    detectedObjects: [
      { label: 'Person (Learner)', count: 22, avgConfidence: 0.948, color: '#10b981' },
      { label: 'Empty Workstation', count: 6, avgConfidence: 0.912, color: '#ef4444' },
      { label: 'Trainer (Instructor)', count: 1, avgConfidence: 0.982, color: '#3b82f6' },
      { label: 'Solar Simulation Bench', count: 2, avgConfidence: 0.965, color: '#f59e0b' }
    ]
  },
  {
    id: 'EVID-0189-ATT-01',
    eventId: 'EVT-2026-0914',
    centreId: 'TC-BLR-0189',
    centreName: 'Karnataka Technical Training Centre — Electronic City',
    title: 'CAM-01 Fiber Optics Lab — Severe Attendance Deficit Evidence Frame',
    captureTimestamp: '2026-09-28T09:28:00.000Z',
    cctvCameraId: 'CAM-01-CLASSROOM',
    mediaType: 'IMAGE',
    sha256: '7a8f3b2190cde4581290384756abcefd01289456723019847562019384756201',
    resolution: '1920x1080',
    fps: 15.0,
    expectedCount: 24,
    detectedCount: 15,
    difference: -9,
    confidence: 0.962,
    inferenceTimeMs: 52.8,
    aiModel: 'YOLOv8-EduCompliance-v2.4',
    detectedObjects: [
      { label: 'Person (Learner)', count: 15, avgConfidence: 0.962, color: '#10b981' },
      { label: 'Empty Chair / Bench', count: 9, avgConfidence: 0.941, color: '#ef4444' },
      { label: 'Trainer (Instructor)', count: 1, avgConfidence: 0.991, color: '#3b82f6' }
    ]
  },
  {
    id: 'EVID-0189-INF-01',
    eventId: 'EVT-2026-0771',
    centreId: 'TC-BLR-0189',
    centreName: 'Karnataka Technical Training Centre — Electronic City',
    title: 'CAM-03 Safety Station Coordinates — Missing Emergency Unit Frame',
    captureTimestamp: '2026-09-28T09:15:00.000Z',
    cctvCameraId: 'CAM-03-SAFETY',
    mediaType: 'IMAGE',
    sha256: '14316d3f3f26040847cb502c3c6f4ef891bb3cd4b07e86d26786c55cbbcc48ee',
    resolution: '1920x1080',
    fps: 12.0,
    expectedCount: 1,
    detectedCount: 0,
    difference: -1,
    confidence: 0.934,
    inferenceTimeMs: 46.1,
    aiModel: 'YOLOv8-EduCompliance-v2.4',
    detectedObjects: [
      { label: 'Empty Wall Mounting Plate', count: 1, avgConfidence: 0.934, color: '#ef4444' }
    ]
  }
];
