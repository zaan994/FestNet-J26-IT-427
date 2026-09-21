import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/routing/app_router.dart';
import '../../../providers/firebase_providers.dart';
import '../../../shared/extensions/context_extensions.dart';
import '../../../shared/widgets/gradient_button.dart';
import '../widgets/auth_scaffold.dart';

/// Self-registration creates a participant account. Volunteer / medical / organiser
/// roles are assigned by an organiser.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final name = _name.text.trim();
      final email = _email.text.trim();
      final user = await ref.read(authServiceProvider).register(email, _password.text, name);
      await ref.read(userRepositoryProvider).createParticipantProfile(uid: user.uid, name: name, email: email);
    } on AppException catch (e) {
      if (mounted) context.showSnack(e.message, error: true);
    } catch (e) {
      if (mounted) context.showSnack(AppException.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Create account',
      subtitle: 'Join FestNet as a festival participant',
      children: [
        Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Full name'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
                validator: (v) => (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password (min 6 characters)'),
                validator: (v) => (v == null || v.length < 6) ? 'At least 6 characters' : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        GradientButton(label: 'Create account', icon: Icons.person_add_alt_1, loading: _busy, onPressed: _submit),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => context.goNamed(Routes.login),
          child: const Text('Already have an account? Sign in'),
        ),
      ],
    );
  }
}
