import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from '../constants/theme';

interface RadarPulseProps {
  isSearching: boolean;
  size?: number;
}

export const RadarPulse: React.FC<RadarPulseProps> = ({
  isSearching,
  size = 240,
}) => {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPulseAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const pulse1 = createPulseAnimation(anim1, 0);
    const pulse2 = createPulseAnimation(anim2, 800);
    const pulse3 = createPulseAnimation(anim3, 1600);

    pulse1.start();
    pulse2.start();
    pulse3.start();

    return () => {
      pulse1.stop();
      pulse2.stop();
      pulse3.stop();
    };
  }, [anim1, anim2, anim3]);

  const renderCircle = (anim: Animated.Value, key: string) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: isSearching ? [0.4, 1.3] : [0.5, 1.05],
    });

    const opacity = anim.interpolate({
      inputRange: [0, 0.4, 0.8, 1],
      outputRange: isSearching ? [0.6, 0.4, 0.15, 0] : [0.35, 0.25, 0.1, 0],
    });

    return (
      <Animated.View
        key={key}
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  return (
    <View style={[styles.container, { width: size * 1.3, height: size * 1.3 }]}>
      {renderCircle(anim1, 'pulse1')}
      {renderCircle(anim2, 'pulse2')}
      {renderCircle(anim3, 'pulse3')}

      {/* Cercle central statique */}
      <View
        style={[
          styles.coreCircle,
          {
            width: size * 0.48,
            height: size * 0.48,
            borderRadius: (size * 0.48) / 2,
            backgroundColor: isSearching ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.18)',
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(227, 242, 253, 0.15)',
  },
  coreCircle: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
