import { logger } from '@agent/shared';
function extractTextFromMessage(message) {
    if (typeof message.content === 'string') {
        return message.content;
    }
    if (Array.isArray(message.content)) {
        const textParts = message.content
            .filter((part) => part.type === 'text')
            .map(part => part.text);
        if (textParts.length > 0) {
            return textParts.join(' ');
        }
    }
    return null;
}
function extractDialogueText(messages) {
    const relevantMessages = messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
    logger.info('Memory extraction filter results', {
        totalMessages: messages.length,
        relevantMessages: relevantMessages.length,
        userMessages: relevantMessages.filter(m => m.role === 'user').length,
        assistantMessages: relevantMessages.filter(m => m.role === 'assistant').length,
    });
    if (relevantMessages.length === 0) {
        logger.info('No messages to extract from');
        return '';
    }
    const dialogueParts = [];
    for (const message of relevantMessages) {
        const text = extractTextFromMessage(message);
        if (text) {
            const prefix = message.role === 'user' ? 'User' : 'Assistant';
            dialogueParts.push(`${prefix}: ${text}`);
        }
    }
    return dialogueParts.join('\n\n');
}
export function createMemoryExtractor(config) {
    const { memoryProvider, groupId = 'default' } = config;
    const pendingExtractions = [];
    let lastProcessedIndex = -1;
    async function doExtraction(dialogueText, messageCount) {
        if (!dialogueText.trim()) {
            logger.debug('No dialogue text to extract memories from');
            return;
        }
        try {
            logger.info('Extracting memories from conversation...', {
                textLength: dialogueText.length,
            });
            const result = await memoryProvider.add({
                content: dialogueText,
                role: 'user',
                groupId,
                source: 'conversation_extraction',
                lastProcessedMessageIndex: messageCount - 1,
            });
            logger.info('Memory extraction complete', {
                factIds: result.factIds.length,
                entityIds: result.entityIds.length,
            });
            lastProcessedIndex = messageCount - 1;
        }
        catch (error) {
            logger.error('Memory extraction failed', { error: String(error) });
        }
    }
    return {
        async extractFromConversation(messages) {
            const newMessages = messages.slice(lastProcessedIndex + 1);
            if (newMessages.length === 0) {
                logger.debug('No new messages to extract from', {
                    totalMessages: messages.length,
                    lastProcessedIndex,
                });
                return;
            }
            logger.info('Processing new messages for extraction', {
                totalMessages: messages.length,
                lastProcessedIndex,
                newMessagesCount: newMessages.length,
            });
            const dialogueText = extractDialogueText(newMessages);
            const extraction = doExtraction(dialogueText, messages.length);
            pendingExtractions.push(extraction);
            try {
                await extraction;
            }
            finally {
                const index = pendingExtractions.indexOf(extraction);
                if (index > -1) {
                    pendingExtractions.splice(index, 1);
                }
            }
        },
        async waitForPending() {
            if (pendingExtractions.length > 0) {
                await Promise.all(pendingExtractions);
            }
        },
    };
}
