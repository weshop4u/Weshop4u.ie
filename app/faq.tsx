import { View, Text, TouchableOpacity, ScrollView, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";
import { ScreenWrapper } from "@/components/native-wrapper";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  icon: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQSection[] = [
  {
    title: "Ordering",
    icon: "🛒",
    items: [
      {
        question: "How do I place an order?",
        answer: "Browse our stores, select the items you want, add them to your cart, and proceed to checkout. You can order as a guest or create an account for faster checkout next time.",
      },
      {
        question: "Can I order without creating an account?",
        answer: "Yes! You can order as a guest. You'll just need to provide your name, phone number (verified with a text code), and delivery address. Guest cash orders are limited to €30 — create an account for higher limits.",
      },
      {
        question: "What's the minimum order amount?",
        answer: "There is no minimum order amount. However, please note that a delivery fee and 10% service fee apply to all orders.",
      },
      {
        question: "Can I modify my order after placing it?",
        answer: "Once an order is placed, it cannot be modified through the app. Please contact us immediately on 089 462 6262 if you need to make changes before the store starts preparing your order.",
      },
      {
        question: "What if an item is out of stock?",
        answer: "During checkout, you can tick 'If item is out of stock, get something similar' to allow the store to substitute with a similar product. If you prefer not to have substitutions, leave this unchecked and the item will simply be removed from your order.",
      },
    ],
  },
  {
    title: "Delivery",
    icon: "🚗",
    items: [
      {
        question: "What areas do you deliver to?",
        answer: "We deliver within a radius of each store's location. The delivery fee is calculated based on the distance from the store to your address. You'll see the exact fee before placing your order.",
      },
      {
        question: "How much is delivery?",
        answer: "The base delivery fee is €3.50, which covers up to 2.8 km from the store. After that, it's €1.00 per additional kilometre. The exact fee is calculated when you enter your address at checkout.",
      },
      {
        question: "How long does delivery take?",
        answer: "Delivery times vary depending on the store's preparation time and the distance to your address. Most orders are delivered within 30–60 minutes. You can track your order in real time through the app.",
      },
      {
        question: "Can I track my delivery?",
        answer: "Yes! Once your order is out for delivery, you can track your driver's location in real time from the Orders tab. You'll also receive notifications as your order progresses.",
      },
      {
        question: "What if I'm not home when the driver arrives?",
        answer: "The driver will attempt to contact you using the phone number provided. If they can't reach you, they may leave the order at your door or return it to the store. Please make sure your phone number is correct.",
      },
    ],
  },
  {
    title: "Payment",
    icon: "💳",
    items: [
      {
        question: "What payment methods do you accept?",
        answer: "We accept Cash on Delivery and Card Payment (via Elavon). Guest users can pay by cash (up to €30) or by card.",
      },
      {
        question: "Is there a cash limit for guest orders?",
        answer: "Yes, guest cash on delivery orders are limited to €30 for security. If your order exceeds this, you can either pay by card or create a free account for higher limits.",
      },
      {
        question: "Can I tip my driver?",
        answer: "Yes! When paying by card, you can add a tip during checkout. You can choose a preset amount (€1, €2, €3, or €5) or enter a custom amount. 100% of tips go directly to your driver.",
      },
      {
        question: "What's the service fee?",
        answer: "A 10% service fee is added to all orders. This helps us maintain the platform, provide customer support, and ensure a reliable delivery service.",
      },
    ],
  },
  {
    title: "Account & Login",
    icon: "👤",
    items: [
      {
        question: "How do I create an account?",
        answer: "Tap 'Sign Up' on the login page and fill in your name, email, phone number, and a password. It only takes a minute!",
      },
      {
        question: "Can I log in with my phone number?",
        answer: "Yes! On the login page, switch to the 'Phone' tab and enter the phone number you registered with, along with your password.",
      },
      {
        question: "I forgot my password. What do I do?",
        answer: "On the login page, tap 'Forgot Password?' and enter your email address. You'll receive instructions to reset your password.",
      },
      {
        question: "Why do I need to verify my phone number?",
        answer: "Phone verification ensures we can contact you about your delivery and helps prevent fraudulent orders. We send a 6-digit code via text that you enter to confirm your number.",
      },
    ],
  },
  {
    title: "Issues & Support",
    icon: "🆘",
    items: [
      {
        question: "My order is wrong or missing items. What do I do?",
        answer: "Contact us immediately on 089 462 6262 or email Weshop4u247@gmail.com. We'll sort it out as quickly as possible.",
      },
      {
        question: "Can I cancel my order?",
        answer: "Orders can only be cancelled before the store accepts them. Contact us on 089 462 6262 as soon as possible if you need to cancel.",
      },
      {
        question: "The app isn't working properly. What should I do?",
        answer: "Try closing and reopening the app, or refreshing the page if you're on the website. If the problem persists, contact us and we'll help you out.",
      },
      {
        question: "How do I contact customer support?",
        answer: "You can reach us 24/7 by calling 089 462 6262 or emailing Weshop4u247@gmail.com. For urgent issues with active orders, calling is the fastest option.",
      },
    ],
  },
];

function FAQItemComponent({ item }: { item: FAQItem }) {
  const [expanded, setExpanded] = useState(false);
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.foreground, lineHeight: 21, paddingRight: 12 }}>
          {item.question}
        </Text>
        <Text style={{ fontSize: 18, color: colors.muted, transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          ›
        </Text>
      </View>
      {expanded && (
        <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 10, paddingRight: 24 }}>
          {item.answer}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function FAQScreen() {
  const router = useRouter();
  const colors = useColors();



  return (
    <ScreenWrapper>
    <ScreenContainer>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{ marginRight: 16 }}
        >
          <Text style={{ color: colors.primary, fontSize: 24 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.foreground }}>FAQ</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Intro */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>
            Frequently Asked Questions
          </Text>
          <Text style={{ fontSize: 15, color: colors.muted, lineHeight: 22 }}>
            Find answers to common questions about ordering, delivery, payments, and more.
          </Text>
        </View>

        {/* FAQ Sections */}
        {FAQ_DATA.map((section, sectionIndex) => (
          <View key={sectionIndex} style={{ marginBottom: 20 }}>
            {/* Section Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
              <Text style={{ fontSize: 22 }}>{section.icon}</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>
                {section.title}
              </Text>
            </View>

            {/* Section Items */}
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 0.5,
              borderColor: colors.border,
              overflow: 'hidden',
            }}>
              {section.items.map((item, itemIndex) => (
                <FAQItemComponent key={itemIndex} item={item} />
              ))}
            </View>
          </View>
        ))}

        {/* Still Need Help */}
        <View style={{
          backgroundColor: colors.primary + '12',
          borderRadius: 16,
          padding: 20,
          alignItems: 'center',
          marginTop: 8,
        }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.foreground, marginBottom: 6 }}>
            Still need help?
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
            Our support team is available 24/7 to assist you.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => Linking.openURL("tel:0894626262")}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 16 }}>📞</Text>
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Call Us</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL("mailto:Weshop4u247@gmail.com")}
              activeOpacity={0.8}
              style={{
                borderWidth: 2,
                borderColor: colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 16 }}>✉️</Text>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Email Us</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
    </ScreenWrapper>
  );
}
