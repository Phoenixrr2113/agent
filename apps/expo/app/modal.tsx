import { Link } from 'expo-router';
import { View, Text, Pressable } from 'react-native';

export default function ModalScreen() {
  return (
    <View className="flex-1 items-center justify-center p-5 bg-white dark:bg-gray-900">
      <Text className="text-3xl font-bold text-gray-900 dark:text-white">
        This is a modal
      </Text>
      <Link href="/" dismissTo asChild>
        <Pressable className="mt-4 py-4">
          <Text className="text-base text-blue-500 leading-8">
            Go to home screen
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
