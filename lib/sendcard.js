import { randomUUID } from 'crypto';
// Masukin SEMUA domain website/aset lu di sini biar foto/musik gak di-block WA
const TRUSTED_DOMAINS = ['renx.dev', 'music.ceciliaa.my.id', 'i.scdn.co', 'free.ceciliaa.my.id'];

export async function sendHtmlCard(xync, chatId, html, title = '') {
    const data = Buffer.from(JSON.stringify({
        __typename: 'GenAIUnifiedResponse',
        response_id: randomUUID(),
        sections: [{
            __typename: 'GenAIUnifiedResponseSection',
            view_model: {
                __typename: 'GenAISingleLayoutViewModel',
                primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    payload: html,
                    trusted_sources: TRUSTED_DOMAINS
                }
            }
        }]
    })).toString('base64');

    let subMsgConfig = [];
    if (title !== '') {
        subMsgConfig = [{ messageType: 2, messageText: title }];
    }

    return xync.relayMessage(chatId, {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: "",
                botResponseId: randomUUID(),
                verificationMetadata: {
                    proofs: [{
                        version: 1,
                        useCase: 1,
                    }]
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: subMsgConfig,
                    unifiedResponse: { data },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardOrigin: 4
                    }
                }
            }
        }
    }, {});
}
