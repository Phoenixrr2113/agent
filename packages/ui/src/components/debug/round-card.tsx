import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StatusBadge } from './status-badge';
import { Section } from './section';
import { ToolCard } from './tool-card';
import { MetricCard } from './metric-card';
import type { RoundCardProps } from './types';

export function RoundCard({
  round,
  expanded,
  onToggle,
  formatDuration,
  formatTime,
}: RoundCardProps) {
  const duration = round.endTime
    ? round.endTime - round.startTime
    : Date.now() - round.startTime;

  return (
    <View className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
      <Pressable
        onPress={onToggle}
        className="px-4 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-3 flex-1">
          <Text className="text-sm font-medium text-gray-900 dark:text-white">
            Round {round.roundIndex + 1}
          </Text>
          <StatusBadge status={round.status} />
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {round.stepsUsed} steps • {round.toolExecutions.length} tools
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatDuration(duration)}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400">
            {expanded ? '▼' : '▶'}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View className="border-t border-gray-200 dark:border-gray-700 p-4">
          <Section title="Input" icon="📥">
            <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
              <Text className="text-sm text-gray-900 dark:text-white">
                {round.input.message}
              </Text>
            </View>
          </Section>

          {round.reasoning.length > 0 && (
            <Section title="Reasoning" icon="🧠">
              {round.reasoning.map((r, i) => (
                <View key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-2">
                  <ScrollView horizontal>
                    <Text className="text-xs font-mono text-gray-600 dark:text-gray-300">
                      {r.content}
                    </Text>
                  </ScrollView>
                  {r.durationMs !== undefined && (
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {formatDuration(r.durationMs)}
                    </Text>
                  )}
                </View>
              ))}
            </Section>
          )}

          {round.toolExecutions.length > 0 && (
            <Section title="Tool Calls" icon="🔧">
              {round.toolExecutions.map((tool) => (
                <View key={tool.toolCallId} className="mb-2">
                  <ToolCard tool={tool} formatDuration={formatDuration} />
                </View>
              ))}
            </Section>
          )}

          {round.output && (
            <Section title="Output" icon="📤">
              <ScrollView className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-h-48">
                <Text className="text-sm text-gray-900 dark:text-white">
                  {round.output.text}
                </Text>
              </ScrollView>
            </Section>
          )}

          {round.errors.length > 0 && (
            <Section title="Errors" icon="❌">
              {round.errors.map((err, i) => (
                <View key={i} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-2">
                  <Text className="text-sm text-red-500 font-medium">
                    {err.code && <Text>[{err.code}] </Text>}
                    {err.message}
                  </Text>
                  {err.stepIndex !== undefined && (
                    <Text className="text-xs text-red-500/70 mt-1">
                      Step {err.stepIndex}
                    </Text>
                  )}
                </View>
              ))}
            </Section>
          )}

          {round.performance && (
            <Section title="Performance" icon="⚡">
              <View className="flex-row flex-wrap gap-2">
                <View className="flex-1 min-w-[80px]">
                  <MetricCard
                    label="Total"
                    value={formatDuration(round.performance.totalDurationMs)}
                  />
                </View>
                <View className="flex-1 min-w-[80px]">
                  <MetricCard
                    label="Execution"
                    value={formatDuration(round.performance.agentExecutionMs)}
                  />
                </View>
                <View className="flex-1 min-w-[80px]">
                  <MetricCard label="Steps" value={String(round.stepsUsed)} />
                </View>
                <View className="flex-1 min-w-[80px]">
                  <MetricCard
                    label="Tools"
                    value={String(round.toolExecutions.length)}
                  />
                </View>
              </View>
            </Section>
          )}
        </View>
      )}
    </View>
  );
}
