      // ── 칭호/뱃지 재계산 ──
      character.totalPlacements = (character.totalPlacements || 0) + 1;

      if (character.totalPlacements >= 10 && character.totalPlacements % 10 === 0) {
        try {
          const { calculateTraits, getBadgeById } = await import('./TraitCalculator');
          const traitResult = await calculateTraits(character);
          character.activeTrait = traitResult.activeTrait;
          character.earnedBadges = traitResult.earnedBadges;
          await character.save();

          // 새 뱃지 획득 시 푸시 알림
          if (traitResult.newBadges.length > 0) {
            const badgeNames = traitResult.newBadges
              .map(id => {
                const b = getBadgeById(id);
                return b ? `${b.emoji} ${b.name}` : id;
              })
              .join(', ');

            sendPushToUser(
              String(placement.userId),
              '🏆 새 뱃지 획득!',
              `${badgeNames}을(를) 달성했어요!`,
              { url: '/badges' }
            ).catch((e) => console.error('[Push] Badge push error:', e));
          }
        } catch (e) {
          console.error('[Trait] Calculation error:', e);
        }
      } else {
        character.totalPlacements = (character.totalPlacements || 0);
        await character.save();
      }
