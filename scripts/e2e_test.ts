import { execSync } from 'child_process';
import { prisma } from '../src/database/prisma.service.js';

const BASE_URL = 'http://localhost:3001/api';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getOtpFromLogs(email: string): string {
    // Wait a brief moment for container logs to flush
    execSync('sleep 1');
    const logs = execSync('docker logs backend-api-1').toString();
    const allMatches = [...logs.matchAll(new RegExp(`Sending OTP (\\d{6}) via Email to ${email}`, 'g'))];
    if (allMatches.length === 0) {
        throw new Error(`OTP not found in logs for email ${email}`);
    }
    return allMatches[allMatches.length - 1][1];
}

async function runTest() {
    console.log('=== STARTING E2E INTEGRATION TEST ===');

    const emailA = `test-user-a-${Date.now()}@securebank.com`;
    const emailB = `test-user-b-${Date.now()}@securebank.com`;
    const password = 'Password123!';

    // 1. REGISTER USER A
    console.log(`\n[1/10] Registering User A (${emailA})...`);
    const regResA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fullName: 'User A Verified',
            email: emailA,
            phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
            password
        })
    });
    const regDataA = await regResA.json() as any;
    if (!regDataA.success) throw new Error(`User A Registration failed: ${JSON.stringify(regDataA)}`);
    const userIdA = regDataA.data.user.id;
    console.log(`User A registered. ID: ${userIdA}`);

    // 2. RETRIEVE & VERIFY USER A OTP
    console.log('\n[2/10] Retrieving OTP for User A from container logs...');
    const otpCodeA = getOtpFromLogs(emailA);
    console.log(`Found User A OTP Code: ${otpCodeA}`);

    console.log('Verifying User A OTP...');
    const verifyResA = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userIdA,
            code: otpCodeA
        })
    });
    const verifyDataA = await verifyResA.json() as any;
    if (!verifyDataA.success) throw new Error(`User A OTP Verification failed: ${JSON.stringify(verifyDataA)}`);
    let tokenA = verifyDataA.data.token;
    console.log('User A OTP verified successfully. Token retrieved.');

    // 3. REGISTER & VERIFY USER B (Unverified User to test limits)
    console.log(`\n[3/10] Registering User B (${emailB})...`);
    const regResB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fullName: 'User B LimitTester',
            email: emailB,
            phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
            password
        })
    });
    const regDataB = await regResB.json() as any;
    if (!regDataB.success) throw new Error(`User B Registration failed: ${JSON.stringify(regDataB)}`);
    const userIdB = regDataB.data.user.id;
    const accountNumberB = regDataB.data.user.accountNumber;
    console.log(`User B registered. ID: ${userIdB}, Account Number: ${accountNumberB}`);

    const otpCodeB = getOtpFromLogs(emailB);
    console.log(`Found User B OTP Code: ${otpCodeB}`);

    console.log('Verifying User B OTP...');
    const verifyResB = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userIdB,
            code: otpCodeB
        })
    });
    const verifyDataB = await verifyResB.json() as any;
    if (!verifyDataB.success) throw new Error(`User B OTP Verification failed: ${JSON.stringify(verifyDataB)}`);
    let tokenB = verifyDataB.data.token;
    console.log('User B OTP verified successfully. Token retrieved.');

    // Give User B enough balance (₦200,000) directly in the database to test limit enforcement
    console.log('Funding User B account directly in DB to ₦200,000...');
    await prisma.bankUser.update({
        where: { id: userIdB },
        data: { walletBalance: 200000.0 }
    });

    // 4. SUBMIT KYC PERSONAL INFO FOR USER A
    console.log('\n[4/10] Submitting KYC Personal Info for User A...');
    const kycSubmitRes = await fetch(`${BASE_URL}/kyc/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({
            legalFirstName: 'User',
            legalLastName: 'A',
            legalMiddleName: 'Verified',
            dateOfBirth: '1995-05-15',
            bvn: '22222222222',
            address: '10 Secure Bank Way',
            city: 'Lagos',
            state: 'Lagos',
            country: 'NG'
        })
    });
    const kycSubmitData = await kycSubmitRes.json() as any;
    if (!kycSubmitData.success) throw new Error(`User A KYC Submission failed: ${JSON.stringify(kycSubmitData)}`);
    console.log(`KYC submitted. Step: ${kycSubmitData.data.registrationStep}, Status: ${kycSubmitData.data.kycStatus}`);

    // 5. VERIFY BVN FOR USER A
    console.log('\n[5/10] Verifying BVN for User A...');
    const bvnVerifyRes = await fetch(`${BASE_URL}/kyc/verify-bvn`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({
            bvn: '22222222222'
        })
    });
    const bvnVerifyData = await bvnVerifyRes.json() as any;
    if (!bvnVerifyData.success) throw new Error(`User A BVN verification failed: ${JSON.stringify(bvnVerifyData)}`);
    console.log(`BVN Verified. Step: ${bvnVerifyData.data.registrationStep}`);

    // 6. PERFORM LIVENESS FOR USER A
    console.log('\n[6/10] Performing Liveness Check for User A...');
    const livenessRes = await fetch(`${BASE_URL}/kyc/liveness`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenA}`
        },
        body: JSON.stringify({
            selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...'
        })
    });
    const livenessData = await livenessRes.json() as any;
    if (!livenessData.success) throw new Error(`User A Liveness check failed: ${JSON.stringify(livenessData)}`);
    console.log(`Liveness Passed. Step: ${livenessData.data.registrationStep}`);

    // 7. CHECK PROFILE OF USER A
    console.log('\n[7/10] Checking User A profile & verification status...');
    const profileResA = await fetch(`${BASE_URL}/users/profile`, {
        headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const profileDataA = await profileResA.json() as any;
    if (!profileDataA.success) throw new Error(`Failed to fetch User A profile: ${JSON.stringify(profileDataA)}`);
    const userA = profileDataA.data;
    console.log(`User A State -> registrationStep: ${userA.registrationStep}, kyc_status: ${userA.kyc_status}`);
    if (userA.registrationStep !== 'ACTIVE' || userA.kyc_status !== 'VERIFIED') {
        throw new Error('User A failed to transition to ACTIVE/VERIFIED status after KYC!');
    }

    // 8. TEST DAILY TRANSACTION LIMIT ENFORCEMENT ON USER B (UNVERIFIED)
    console.log('\n[8/10] Testing daily transaction limits for User B...');
    console.log('Attempting to transfer ₦150,000 from User B to User A (Limit: ₦100,000)...');
    const transferOverLimitRes = await fetch(`${BASE_URL}/transactions/transfer`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenB}`
        },
        body: JSON.stringify({
            receiverAccountNumber: userA.accountNumber,
            amount: 150000.0,
            pin: '1234',
            category: 'Transfer',
            description: 'Over limit test'
        })
    });
    const transferOverLimitData = await transferOverLimitRes.json() as any;
    console.log(`Response message: "${transferOverLimitData.message}"`);
    if (transferOverLimitRes.status !== 400 && transferOverLimitData.success) {
        throw new Error('Transfer exceeding ₦100,000 should have been rejected for unverified User B!');
    }
    if (!transferOverLimitData.message.includes('Daily transfer limit exceeded')) {
        throw new Error(`Expected daily limit warning, got: "${transferOverLimitData.message}"`);
    }
    console.log('Rejection verified. Daily limit enforcement works correctly.');

    // 9. EXECUTE SUCCESSFUL TRANSFER UNDER LIMIT
    console.log('\n[9/10] Executing successful transfer of ₦5,000 from User B to User A...');
    const transferRes = await fetch(`${BASE_URL}/transactions/transfer`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenB}`
        },
        body: JSON.stringify({
            receiverAccountNumber: userA.accountNumber,
            amount: 5000.0,
            pin: '1234',
            category: 'Transfer',
            description: 'Success transfer test'
        })
    });
    const transferData = await transferRes.json() as any;
    if (!transferData.success) {
        throw new Error(`Successful transfer failed: ${JSON.stringify(transferData)}`);
    }
    const reference = transferData.data.reference;
    console.log(`Transfer successful. Reference: ${reference}`);

    // Query database to get the transaction ID from reference
    console.log('Resolving transaction ID from database...');
    const tx = await prisma.transaction.findUnique({
        where: { reference }
    });
    if (!tx) throw new Error('Transaction record not found in database!');
    const txId = tx.id;
    console.log(`Resolved transaction UUID: ${txId}`);

    // 10. GET TRANSACTION RECEIPT
    console.log('\n[10/10] Retrieving Transaction Receipt for User A...');
    const receiptRes = await fetch(`${BASE_URL}/transactions/${txId}/receipt`, {
        headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const receiptData = await receiptRes.json() as any;
    if (!receiptData.success) {
        throw new Error(`Failed to retrieve receipt: ${JSON.stringify(receiptData)}`);
    }
    console.log('Receipt details successfully retrieved:');
    console.log(`- Amount: ₦${receiptData.data.amount}`);
    console.log(`- Sender Account: ${receiptData.data.sender.accountNumber}`);
    console.log(`- Receiver Account: ${receiptData.data.receiver.accountNumber}`);

    console.log('\n=== E2E INTEGRATION TEST COMPLETED SUCCESSFULLY ===');
}

runTest().catch((err) => {
    console.error('\n❌ E2E TEST FAILED:', err.message || err);
    process.exit(1);
});
